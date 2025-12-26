"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { expandSkillKeysWithLevels, loadSelectedSkillsFromStorage } from "@/lib/skills-storage";
import { loadSelectedJob, loadSelectedMajor } from "@/lib/pathway-storage";
import { getJobMajors, getMajorGaps, getPathwaySummary } from "@/lib/backend-api";
import type { BackendPathwaySummary } from "@/types/api";

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

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const [recommendedMajor, setRecommendedMajor] = useState<{ major_id: string; major_name: string } | null>(null);
  const [gaps, setGaps] = useState<string[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);

  const [summary, setSummary] = useState<BackendPathwaySummary | null>(null);

  const selectedSkills = useMemo(() => loadSelectedSkillsFromStorage(), []);
  const selectedJob = useMemo(() => loadSelectedJob(), []);
  const selectedMajor = useMemo(() => loadSelectedMajor(), []);
  const onboardingFutureJob = useMemo(() => loadOnboardingFutureJob(), []);

  const skillKeys = useMemo(() => {
    return expandSkillKeysWithLevels(selectedSkills).filter((k) => typeof k === "string" && k.trim().length > 0);
  }, [selectedSkills]);

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setGapsError(null);
    setGaps([]);
    setRecommendedMajor(null);

    (async () => {
      try {
        // Preferred: backend-provided summary (single source of truth)
        try {
          const s = await getPathwaySummary(token);
          if (!cancelled) {
            setSummary(s);

            const major = s?.recommended_major;
            if (major && major.major_id != null) {
              setRecommendedMajor({
                major_id: String(major.major_id),
                major_name: String(major.major_name ?? ""),
              });
            }

            const gapNames = Array.isArray(s?.gaps)
              ? s.gaps
                  .map((g) => {
                    if (typeof g?.name === "string") return g.name.trim();
                    const alt = (g as { skill_name?: unknown })?.skill_name;
                    return typeof alt === "string" ? alt.trim() : "";
                  })
                  .filter((n) => n.length > 0)
                  .slice(0, 25)
              : [];

            setGaps(gapNames);
            setGapsError(null);
          }

          // If summary worked, we are done.
          return;
        } catch {
          // Fall back to client-side stitching below.
          if (!cancelled) setSummary(null);
        }

        // 1) Determine the major to show (prefer selected major; else derive from selected job)
        let majorIdForUi: string | null = selectedMajor?.major_id ? String(selectedMajor.major_id) : null;
        let majorNameForUi: string | null = selectedMajor?.major_name ? String(selectedMajor.major_name) : null;

        if (!majorIdForUi && selectedJob?.job_id) {
          const majors = await getJobMajors(String(selectedJob.job_id), 1);
          const top = Array.isArray(majors) ? majors[0] : null;
          if (top && top.major_id != null && typeof top.major_name === "string") {
            majorIdForUi = String(top.major_id);
            majorNameForUi = top.major_name;
          }
        }

        if (!cancelled) {
          setRecommendedMajor(majorIdForUi && majorNameForUi ? { major_id: majorIdForUi, major_name: majorNameForUi } : null);
        }

        // 2) If we have a major + skills, fetch gaps
        if (!majorIdForUi) return;
        if (skillKeys.length === 0) return;

        if (!cancelled) {
          setGapsLoading(true);
          setGapsError(null);
          setGaps([]);
        }

        const gapItems = await getMajorGaps(majorIdForUi, skillKeys);
        const names = Array.isArray(gapItems)
          ? gapItems
              .map((g) => {
                if (typeof g?.name === "string") return g.name.trim();
                const alt = (g as { skill_name?: unknown })?.skill_name;
                return typeof alt === "string" ? alt.trim() : "";
              })
              .filter((n) => n.length > 0)
              .slice(0, 25)
          : [];

        if (!cancelled) setGaps(names);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load gap analysis";
        setGapsError(message);
        setGaps([]);
      } finally {
        if (!cancelled) setGapsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedJob, selectedMajor, skillKeys]);

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
            Edit in dashboard
          </Link>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Your pathway summary</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">Current skills</div>
            {selectedSkills.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No selected skills yet. Add skills in the dashboard or onboarding.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedSkills.slice(0, 30).map((s) => (
                  <span key={s.skill_key} className="rounded-full border bg-slate-50 px-3 py-1 text-xs text-slate-700">
                    {s.name} · L{s.level}
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

          {gapsLoading && <div className="mt-3 text-sm text-slate-500">Loading gaps…</div>}
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
              {gaps.map((name) => (
                <li key={name} className="rounded-xl bg-red-50 px-3 py-2">
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
