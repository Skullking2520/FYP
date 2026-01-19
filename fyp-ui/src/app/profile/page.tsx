"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  formatSkillLabel,
  loadSelectedSkillsFromStorage,
  looksLikeUuid,
  normalizeSkillKey,
  saveSelectedSkillsToStorage,
  SELECTED_SKILLS_STORAGE_KEY,
} from "@/lib/skills-storage";
import { loadSelectedJob, loadSelectedMajor } from "@/lib/pathway-storage";
import { BackendRequestError, getJobMajors, getMajorGaps, getPathwaySummary, resolveSkills } from "@/lib/backend-api";
import type { BackendMajorSkill, BackendPathwaySummary } from "@/types/api";
import type { SelectedSkill } from "@/components/skill-picker";
import { getStructuredProfile } from "@/lib/api";

const SELECTED_JOB_STORAGE_KEY = "selected_job_v1";
const SELECTED_MAJOR_STORAGE_KEY = "selected_major_v1";

function normalizeSummaryLevelToUi(level: unknown): number {
  const n = typeof level === "number" && Number.isFinite(level) ? level : 0;
  // Most backend payloads historically used 0..5. Our UI uses 0..10.
  const scaled = n <= 5 ? n * 2 : n;
  return Math.max(0, Math.min(10, scaled));
}

function getMajorSkillRawName(g: BackendMajorSkill): string {
  if (typeof g?.name === "string" && g.name.trim()) return g.name.trim();
  const alt = (g as { skill_name?: unknown })?.skill_name;
  return typeof alt === "string" ? alt.trim() : "";
}

function getMajorSkillDisplayName(g: BackendMajorSkill, resolvedByKey: Record<string, string>): string {
  const k = typeof g?.skill_key === "string" ? g.skill_key.trim() : "";
  if (k && resolvedByKey[k]) return resolvedByKey[k];
  const rawName = getMajorSkillRawName(g);
  const label = formatSkillLabel(rawName, k || rawName || "");
  return label || "(unknown skill)";
}

function loadOnboardingFutureJob(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("onboardingData");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const career = (parsed as Record<string, unknown>)["career"];
    if (!career || typeof career !== "object") return null;
    const targetJobs = (career as Record<string, unknown>)["targetJobs"];
    if (!Array.isArray(targetJobs)) return null;
    const first = targetJobs.find((x) => typeof x === "string" && x.trim().length > 0);
    return typeof first === "string" ? first.trim() : null;
  } catch {
    return null;
  }
}

function sameSelectedJob(a: ReturnType<typeof loadSelectedJob>, b: ReturnType<typeof loadSelectedJob>): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.job_id === b.job_id && (a.title ?? "") === (b.title ?? "");
}

function sameSelectedMajor(a: ReturnType<typeof loadSelectedMajor>, b: ReturnType<typeof loadSelectedMajor>): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.major_id === b.major_id && (a.major_name ?? "") === (b.major_name ?? "");
}

function sameSelectedSkills(a: SelectedSkill[], b: SelectedSkill[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i];
    const sb = b[i];
    if (sa.skill_key !== sb.skill_key) return false;
    if (sa.level !== sb.level) return false;
  }
  return true;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const loadSeqRef = useRef(0);

  const [recommendedMajor, setRecommendedMajor] = useState<{ major_id: string; major_name: string } | null>(null);
  const [gaps, setGaps] = useState<BackendMajorSkill[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);
  const [gapSkillNameByKey, setGapSkillNameByKey] = useState<Record<string, string>>({});

  const [summary, setSummary] = useState<BackendPathwaySummary | null>(null);

  const [selectedSkills, setSelectedSkills] = useState(() => loadSelectedSkillsFromStorage());
  const [selectedJob, setSelectedJob] = useState(() => loadSelectedJob());
  const [selectedMajor, setSelectedMajor] = useState(() => loadSelectedMajor());
  const onboardingFutureJob = useMemo(() => loadOnboardingFutureJob(), []);

  useEffect(() => {
    // When navigating away (e.g., to update skills) and coming back via client routing,
    // this page may remain mounted. Refresh from localStorage on focus/visibility.
    const refresh = () => {
      const nextSkills = loadSelectedSkillsFromStorage();
      const nextJob = loadSelectedJob();
      const nextMajor = loadSelectedMajor();

      setSelectedSkills((prev) => (sameSelectedSkills(prev, nextSkills) ? prev : nextSkills));
      setSelectedJob((prev) => (sameSelectedJob(prev, nextJob) ? prev : nextJob));
      setSelectedMajor((prev) => (sameSelectedMajor(prev, nextMajor) ? prev : nextMajor));
    };

    const onFocus = () => refresh();
    const onVisibilityChange = () => {
      if (!document.hidden) refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const summarySkills = useMemo<SelectedSkill[]>(() => {
    const raw = Array.isArray(summary?.skills) ? summary!.skills : [];
    return raw
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const record = s as Record<string, unknown>;
        const key = normalizeSkillKey(String(record.skill_key ?? ""));
        if (!key) return null;
        const name = typeof record.name === "string" ? record.name : "";
        const level = normalizeSummaryLevelToUi(record.level);
        return {
          skill_key: key,
          name: formatSkillLabel(name, key) || "(unknown skill)",
          level,
        } satisfies SelectedSkill;
      })
      .filter((x): x is SelectedSkill => Boolean(x));
  }, [summary]);

  useEffect(() => {
    // If localStorage lost skills but backend summary has them, hydrate local state/storage.
    if (selectedSkills.length > 0) return;
    if (summarySkills.length === 0) return;
    setSelectedSkills(summarySkills);
    saveSelectedSkillsToStorage(summarySkills);
  }, [selectedSkills.length, summarySkills]);

  useEffect(() => {
    // If summary doesn't include skills but we saved structured skills earlier,
    // pull them from /users/me/profile and hydrate local state/storage.
    if (!token) return;
    if (selectedSkills.length > 0) return;
    if (summarySkills.length > 0) return;

    let cancelled = false;
    getStructuredProfile(token)
      .then((p) => {
        if (cancelled) return;
        const raw = Array.isArray(p?.skills) ? p.skills : [];
        if (raw.length === 0) return;
        const next: SelectedSkill[] = raw
          .map((s) => {
            const key = normalizeSkillKey(String(s.skill_key ?? ""));
            if (!key) return null;
            const level = normalizeSummaryLevelToUi(s.level);
            return { skill_key: key, name: "(saved skill)", level } satisfies SelectedSkill;
          })
          .filter((x): x is SelectedSkill => Boolean(x));
        if (next.length === 0) return;
        setSelectedSkills(next);
        saveSelectedSkillsToStorage(next);
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, [token, selectedSkills.length, summarySkills.length]);

  const effectiveSkills = useMemo<SelectedSkill[]>(() => {
    return selectedSkills.length > 0 ? selectedSkills : summarySkills;
  }, [selectedSkills, summarySkills]);

  const skillKeys = useMemo(() => {
    const keys = Array.isArray(effectiveSkills)
      ? effectiveSkills.map((s) => normalizeSkillKey(s.skill_key)).filter((k) => typeof k === "string" && k.trim().length > 0)
      : [];
    return Array.from(new Set(keys));
  }, [effectiveSkills]);

  useEffect(() => {
    // Ensure we pick up the latest skills on first mount.
    queueMicrotask(() => {
      const nextSkills = loadSelectedSkillsFromStorage();
      const nextJob = loadSelectedJob();
      const nextMajor = loadSelectedMajor();
      setSelectedSkills((prev) => (sameSelectedSkills(prev, nextSkills) ? prev : nextSkills));
      setSelectedJob((prev) => (sameSelectedJob(prev, nextJob) ? prev : nextJob));
      setSelectedMajor((prev) => (sameSelectedMajor(prev, nextMajor) ? prev : nextMajor));
    });

    // Keep in sync across tabs/windows.
    const onStorage = (event: StorageEvent) => {
      if (event.key === SELECTED_SKILLS_STORAGE_KEY) {
        const next = loadSelectedSkillsFromStorage();
        setSelectedSkills((prev) => (sameSelectedSkills(prev, next) ? prev : next));
      }
      if (event.key === SELECTED_JOB_STORAGE_KEY) {
        const next = loadSelectedJob();
        setSelectedJob((prev) => (sameSelectedJob(prev, next) ? prev : next));
      }
      if (event.key === SELECTED_MAJOR_STORAGE_KEY) {
        const next = loadSelectedMajor();
        setSelectedMajor((prev) => (sameSelectedMajor(prev, next) ? prev : next));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;

    const seq = ++loadSeqRef.current;

    setGapsError(null);
    setRecommendedMajor(null);
    setGapsLoading(false);

    (async () => {
      try {
        // Preferred: backend-provided summary (single source of truth)
        try {
          const s = await getPathwaySummary(token);
          if (loadSeqRef.current !== seq) return;

          setSummary(s);

          const major = s?.recommended_major;
          if (major && major.major_id != null) {
            setRecommendedMajor({
              major_id: String(major.major_id),
              major_name: String(major.major_name ?? ""),
            });
          }

          const majorIdFromSummary = major && major.major_id != null ? String(major.major_id) : null;

          const gapItems = Array.isArray(s?.gaps)
            ? s.gaps.filter((g): g is BackendMajorSkill => Boolean(g)).slice(0, 25)
            : [];

          setGaps(gapItems);
          setGapsError(null);

          // Some backends compute pathway-summary gaps from a different skill source.
          // If summary returns no gaps but we have local selected skills, fall back to
          // the dedicated gaps endpoint so the UI stays useful.
          const summarySkillKeys = Array.from(
            new Set(
              (Array.isArray(s?.skills) ? s.skills : [])
                .map((sk) => {
                  if (!sk || typeof sk !== "object") return "";
                  const r = sk as Record<string, unknown>;
                  return normalizeSkillKey(String(r.skill_key ?? ""));
                })
                .filter((k) => k.length > 0),
            ),
          );

          const keysForFallback = skillKeys.length > 0 ? skillKeys : summarySkillKeys;

          if (gapItems.length === 0 && majorIdFromSummary) {
            setGapsLoading(true);
            try {
              let gapItems2 = await getMajorGaps(majorIdFromSummary, keysForFallback, token);
              if (Array.isArray(gapItems2) && gapItems2.length === 0 && keysForFallback.length > 0) {
                gapItems2 = await getMajorGaps(majorIdFromSummary, [], token);
              }
              if (loadSeqRef.current !== seq) return;
              const items2 = Array.isArray(gapItems2)
                ? gapItems2.filter((g): g is BackendMajorSkill => Boolean(g)).slice(0, 25)
                : [];
              setGaps(items2);
              setGapsError(null);
            } catch (err) {
              if (loadSeqRef.current !== seq) return;
              if (err instanceof BackendRequestError && (err.status === 401 || err.status === 403)) {
                setGapsError("Your session has expired. Please log in again.");
                setGaps([]);
              } else {
                const message = err instanceof Error ? err.message : "Failed to load gap analysis";
                setGapsError(message);
                setGaps([]);
              }
            } finally {
              if (loadSeqRef.current === seq) setGapsLoading(false);
            }
          }

          // If summary included a recommended major id, we are done.
          // Some deployments omit recommended_major; in that case, fall through
          // to client-side stitching so Profile can still show gaps.
          if (majorIdFromSummary) return;
        } catch {
          // Fall back to client-side stitching below.
          if (loadSeqRef.current === seq) setSummary(null);
        }

        // 1) Determine the major to show (prefer selected major; else derive from selected job)
        let majorIdForUi: string | null = selectedMajor?.major_id ? String(selectedMajor.major_id) : null;
        let majorNameForUi: string | null = selectedMajor?.major_name ? String(selectedMajor.major_name) : null;

        if (!majorIdForUi && selectedJob?.job_id) {
          const majors = await getJobMajors(String(selectedJob.job_id), 1);
          const top = Array.isArray(majors) ? majors[0] : null;
          if (top && top.major_id != null) {
            majorIdForUi = String(top.major_id);
            majorNameForUi = typeof top.major_name === "string" ? top.major_name : majorNameForUi;
          }
        }

        if (loadSeqRef.current === seq) {
          setRecommendedMajor(
            majorIdForUi
              ? { major_id: majorIdForUi, major_name: typeof majorNameForUi === "string" ? majorNameForUi : "" }
              : null,
          );
        }

        // 2) If we have a major, fetch gaps (some backends return useful defaults even when skill_keys is empty)
        if (!majorIdForUi) return;

        if (loadSeqRef.current === seq) {
          setGapsLoading(true);
          setGapsError(null);
        }

        let gapItems = await getMajorGaps(majorIdForUi, skillKeys, token);
        if (Array.isArray(gapItems) && gapItems.length === 0 && skillKeys.length > 0) {
          gapItems = await getMajorGaps(majorIdForUi, [], token);
        }
        const items = Array.isArray(gapItems) ? gapItems.filter((g): g is BackendMajorSkill => Boolean(g)).slice(0, 25) : [];

        if (loadSeqRef.current === seq) setGaps(items);
      } catch (err) {
        if (loadSeqRef.current !== seq) return;
        if (err instanceof BackendRequestError && (err.status === 401 || err.status === 403)) {
          setGapsError("Your session has expired. Please log in again.");
          setGaps([]);
        } else {
          const message = err instanceof Error ? err.message : "Failed to load gap analysis";
          setGapsError(message);
          setGaps([]);
        }
      } finally {
        if (loadSeqRef.current === seq) setGapsLoading(false);
      }
    })();
    return;
  }, [token, selectedJob, selectedMajor, skillKeys]);

  useEffect(() => {
    const unresolved = gaps
      .map((g) => {
        const k = typeof g?.skill_key === "string" ? g.skill_key.trim() : "";
        if (!k || gapSkillNameByKey[k]) return "";
        const rawName = getMajorSkillRawName(g);
        const label = formatSkillLabel(rawName, k || rawName || "");
        const needsResolve = !label || looksLikeUuid(rawName) || looksLikeUuid(k);
        return needsResolve ? k : "";
      })
      .filter((k) => k.length > 0);
    if (unresolved.length === 0) return;

    let cancelled = false;
    resolveSkills(Array.from(new Set(unresolved)))
      .then((items) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const item of items) {
        if (!item?.resolved || !item.skill_name) continue;
        next[item.skill_key] = item.skill_name;
      }
      if (Object.keys(next).length === 0) return;
      setGapSkillNameByKey((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {
        // ignore resolve failures
      });

    return () => {
      cancelled = true;
    };
  }, [gapSkillNameByKey, gaps]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Checking your session...</div>;
  }

  if (!user) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Please sign in</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to view your profile.</p>
          <Link href="/login" className="mt-4 inline-flex rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Your profile</p>
            <h1 className="text-3xl font-semibold text-slate-900">{user.name || user.email}</h1>
            <p className="mt-2 text-sm text-slate-600">Email: {user.email}</p>
          </div>
          <Link href="/dashboard" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-900">
            Edit in onboarding
          </Link>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Your pathway summary</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">Current skills</div>
            {effectiveSkills.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No selected skills yet. Add skills in onboarding.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {effectiveSkills.slice(0, 30).map((s) => (
                  <span key={s.skill_key} className="rounded-full border bg-slate-50 px-3 py-1 text-xs text-slate-700">
                    {formatSkillLabel(s.name, s.skill_key) || "(unknown skill)"} · L{s.level}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">Desired job</div>
            <p className="mt-2 text-sm text-slate-700">
              {selectedJob?.title ??
                selectedJob?.job_id ??
                onboardingFutureJob ??
                summary?.desired_job?.title ??
                summary?.desired_job?.job_id ??
                "—"}
            </p>
            <div className="mt-4 text-sm font-semibold text-slate-900">Recommended major</div>
            <p className="mt-2 text-sm text-slate-700">{recommendedMajor?.major_name ?? selectedMajor?.major_name ?? "—"}</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Skill gaps for the recommended major</div>
              <div className="text-sm text-slate-600">Missing skills based on your selected skills.</div>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-900">
                Update skills
              </Link>
              <Link href="/pathway/jobs" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-900">
                Update job/major
              </Link>
            </div>
          </div>

          {gapsLoading && <div className="mt-3 text-sm text-slate-500">Loading gaps...</div>}
          {gapsError && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{gapsError}</div>}

          {!gapsLoading && !gapsError && gaps.length === 0 && (
            <div className="mt-3 text-sm text-slate-500">
              {recommendedMajor || selectedMajor
                ? "No gaps returned (or you already cover them)."
                : "Pick a job/major first to see gaps."}
            </div>
          )}

          {!gapsLoading && !gapsError && gaps.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm text-red-700">
              {gaps.map((g, idx) => {
                const k = typeof g?.skill_key === "string" ? g.skill_key.trim() : "";
                const display = getMajorSkillDisplayName(g, gapSkillNameByKey);
                return (
                  <li key={`${k || display}-${idx}`} className="rounded-xl bg-red-50 px-3 py-2">
                    {display}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
