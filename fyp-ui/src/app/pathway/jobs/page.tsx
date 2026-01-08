"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { extractSkillsFromText, logRecommendJobPick, recommendJobsWithTracking, searchJobs, searchSkills } from "@/lib/backend-api";
import { useAuth } from "@/components/auth-provider";
import { setSelectedJob } from "@/lib/api";
import { clearSelectedMajor, loadSelectedJob, saveSelectedJob } from "@/lib/pathway-storage";
import { expandSkillKeysWithLevels, loadSelectedSkillsFromStorage, SELECTED_SKILLS_STORAGE_KEY } from "@/lib/skills-storage";
import type { BackendJobRecommendation, BackendJobSearchResult } from "@/types/api";
import type { SelectedSkill } from "@/components/skill-picker";

function formatScore(score: unknown): string {
  if (typeof score === "number" && Number.isFinite(score)) return score.toFixed(3);
  if (typeof score === "string" && score.trim()) {
    const parsed = Number(score);
    if (Number.isFinite(parsed)) return parsed.toFixed(3);
    return score;
  }
  return "N/A";
}

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchJobByTitle(targetTitle: string, jobs: BackendJobRecommendation[]): BackendJobRecommendation | null {
  const desired = normalizeTitle(targetTitle);
  if (!desired) return null;
  const list = Array.isArray(jobs) ? jobs : [];
  return (
    list.find((j) => normalizeTitle(j.title ?? "") === desired) ??
    list.find((j) => {
      const t = normalizeTitle(j.title ?? "");
      return t.includes(desired) || desired.includes(t);
    }) ??
    null
  );
}

function matchSearchResultByTitle(
  targetTitle: string,
  items: BackendJobSearchResult[],
): BackendJobSearchResult | null {
  const desired = normalizeTitle(targetTitle);
  if (!desired) return null;
  return (
    items.find((j) => normalizeTitle(String(j.title ?? "")) === desired) ??
    items.find((j) => {
      const t = normalizeTitle(String(j.title ?? ""));
      return t.includes(desired) || desired.includes(t);
    }) ??
    null
  );
}


function loadUserTypedTargetJob(): string | null {
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

export default function PathwayJobsPage() {
  const router = useRouter();
  const { token } = useAuth();

  const [skills, setSkills] = useState<SelectedSkill[]>(() => loadSelectedSkillsFromStorage());
  const [targetJob, setTargetJob] = useState<string | null>(() => (typeof window === "undefined" ? null : loadUserTypedTargetJob()));
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() => (typeof window === "undefined" ? null : loadSelectedJob()?.job_id ?? null));

  const persistSelectedJob = useCallback(
    (job: { job_id: string; title?: string | null; recommendation_id?: string | number | null }) => {
      const jobId = String(job.job_id);
      const title = typeof job.title === "string" ? job.title : "";
      const recId =
        job.recommendation_id === null || job.recommendation_id === undefined
          ? null
          : String(job.recommendation_id).trim() || null;

      saveSelectedJob({ job_id: jobId, title: title || undefined });
      setSelectedJobId(jobId);

      if (!token) return;
      void setSelectedJob(token, {
        job_id: jobId,
        job_title: title || jobId,
        recommendation_id: recId,
      }).catch((err) => {
        console.warn("Failed to persist selected job", err);
      });

      if (recId) {
        void logRecommendJobPick(recId, jobId, token).catch((err) => {
          console.warn("Failed to log recommendation pick", err);
        });
      }
    },
    [token],
  );

  const selectedJobTitle = useMemo(() => {
    if (typeof window === "undefined") return null;
    void selectedJobId;
    const stored = loadSelectedJob();
    return stored?.title ?? null;
  }, [selectedJobId]);
  const [jobs, setJobs] = useState<BackendJobRecommendation[]>([]);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storedSelectedJob = useMemo(() => {
    if (typeof window === "undefined") return null;
    void selectedJobId;
    return loadSelectedJob();
  }, [selectedJobId]);

  const targetJobMatch = useMemo(() => {
    if (!targetJob) return null;
    return matchJobByTitle(targetJob, jobs);
  }, [targetJob, jobs]);

  const onStorage = useCallback((event: StorageEvent) => {
    if (event.key === SELECTED_SKILLS_STORAGE_KEY) {
      setSkills(loadSelectedSkillsFromStorage());
      return;
    }
    if (event.key === "onboardingData") {
      setTargetJob(loadUserTypedTargetJob());
      return;
    }
    if (event.key === "selected_job_v1") {
      setSelectedJobId(loadSelectedJob()?.job_id ?? null);
    }
  }, []);

  useEffect(() => {
    // New flow always re-derives downstream selections from current skills.
    clearSelectedMajor();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [onStorage]);

  const skillKeys = useMemo(
    () => expandSkillKeysWithLevels(skills),
    [skills],
  );

  useEffect(() => {
    if (skillKeys.length === 0) {
      queueMicrotask(() => {
        setJobs([]);
        setRecommendationId(null);
        setError(null);
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setJobs([]);
      setRecommendationId(null);
    });

    recommendJobsWithTracking(skillKeys, token)
      .then(({ items, recommendation_id }) => {
        if (cancelled) return;
        setJobs(Array.isArray(items) ? items : []);
        setRecommendationId(recommendation_id);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load job recommendations";
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [skillKeys, token]);

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm uppercase tracking-wide text-slate-500">Step 1</p>
        <h1 className="text-2xl font-semibold text-slate-900">Select a job</h1>
        <p className="mt-2 text-sm text-slate-600">We recommend jobs based on your selected skills (and skill levels).</p>
        <div className="mt-4 text-sm text-slate-600">
          Using {skills.length} selected skill{skills.length === 1 ? "" : "s"}
        </div>

        {targetJob && (
          <div className="mt-4 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
            <div>
              You selected this as your future job: <span className="font-semibold text-slate-900">{targetJob}</span>
            </div>
            <div className="mt-1 text-slate-600">Based on your skills, these roles may also fit you well.</div>
            {!loading && !error && jobs.length > 0 && (
              <div className="mt-2 text-slate-700">
                Top match right now: <span className="font-semibold text-slate-900">{jobs[0]?.title}</span>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-600">
                Continue with your future job (we will match it to a job from the recommended list).
              </div>
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={loading}
                onClick={() => {
                  setError(null);
                  if (skills.length === 0) {
                    setError("Please pick skills first so we can match your job.");
                    return;
                  }
                  // Best-effort: if we already have a direct title match from the current recommendations, use it.
                  if (targetJobMatch) {
                    persistSelectedJob({
                      job_id: String(targetJobMatch.job_id),
                      title: targetJobMatch.title,
                      recommendation_id: recommendationId,
                    });
                    router.push("/pathway/majors");
                    return;
                  }

                  (async () => {
                    try {
                      // Preferred: resolve the typed title via backend search API.
                      const search = await searchJobs(targetJob, 50);
                      const found = matchSearchResultByTitle(targetJob, search);
                      if (found) {
                        const jobRef = typeof found.job_ref === "string" && found.job_ref.trim() ? found.job_ref.trim() : null;
                        const jobId = found.job_id;
                        const idToStore = jobRef ?? (typeof jobId === "string" ? jobId : String(jobId));
                        persistSelectedJob({ job_id: idToStore, title: targetJob });
                        router.push("/pathway/majors");
                        return;
                      }

                      // Resolve the typed job title by extracting related skills and re-running recommendation.
                      const extracted = await extractSkillsFromText(targetJob, token);
                      const names = Array.isArray(extracted?.skills)
                        ? extracted.skills
                            .map((s) => (typeof s?.skill_name === "string" ? s.skill_name.trim() : ""))
                            .filter(Boolean)
                            .slice(0, 10)
                        : [];

                      const resolvedSkillKeys: string[] = [];
                      for (const name of names) {
                        const hits = await searchSkills(name);
                        const key = hits?.[0]?.skill_key;
                        if (typeof key === "string" && key.trim()) {
                          resolvedSkillKeys.push(key.trim());
                        }
                        if (resolvedSkillKeys.length >= 20) break;
                      }

                      const uniq = Array.from(new Set(resolvedSkillKeys));
                      if (uniq.length === 0) {
                        setError("We couldn't resolve your future job. Please select a job below.");
                        return;
                      }

                      const tracked = await recommendJobsWithTracking(uniq, token);
                      const recs = tracked.items;
                      const matched = matchJobByTitle(targetJob, Array.isArray(recs) ? recs : []);
                      const best = matched ?? (Array.isArray(recs) && recs.length > 0 ? recs[0] : null);
                      if (!best) {
                        // Last resort: if recommendations exist on the page, continue with top-1.
                        const fallbackFromCurrent = jobs.length > 0 ? jobs[0] : null;
                        if (fallbackFromCurrent) {
                          persistSelectedJob({
                            job_id: String(fallbackFromCurrent.job_id),
                            title: targetJob,
                            recommendation_id: recommendationId,
                          });
                          router.push("/pathway/majors");
                          return;
                        }
                        setError("We couldn't resolve your future job. Please select a job below.");
                        return;
                      }

                      persistSelectedJob({
                        job_id: String(best.job_id),
                        title: targetJob,
                        recommendation_id: tracked.recommendation_id,
                      });
                      router.push("/pathway/majors");
                    } catch {
                      setError("We couldn't resolve your future job. Please select a job below.");
                    }
                  })();
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {!targetJob && selectedJobId && (
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-700">
              Already selected: <span className="font-semibold text-slate-900">{selectedJobTitle ?? selectedJobId}</span>
            </div>
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setError(null);
                // Re-affirm the previous selection and continue.
                if (storedSelectedJob?.job_id) {
                  persistSelectedJob({ job_id: String(storedSelectedJob.job_id), title: storedSelectedJob.title ?? null });
                }
                router.push("/pathway/majors");
              }}
            >
              Continue
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        )}
      </header>

      {skills.length === 0 && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-700">No skills selected yet.</div>
          <p className="mt-2 text-sm text-slate-600">Go to Onboarding and pick skills first, then come back here.</p>
          <div className="mt-4 flex gap-3">
            <Link href="/dashboard" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Go to onboarding
            </Link>
          </div>
        </section>
      )}

      {skills.length > 0 && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Job recommendations (Top 5)</h2>

          {loading && <div className="mt-4 text-sm text-slate-500">Loading job recommendations…</div>}

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

          {!loading && !error && jobs.length === 0 && (
            <div className="mt-4 text-sm text-slate-500">No job recommendations returned. Try different skills.</div>
          )}

          {!loading && !error && jobs.length > 0 && (
            <ul className="mt-4 space-y-2">
              {jobs.slice(0, 5).map((job) => (
                <li
                  key={String(job.job_id)}
                  className={`rounded-xl border p-4 ${selectedJobId === String(job.job_id) ? "ring-2 ring-blue-600" : ""}`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{job.title}</div>
                      <div className="text-sm text-slate-600">
                        Source: {job.source ?? "Unknown"} · Matched: {job.matched_skills ?? 0} · Score: {formatScore(job.score)}
                      </div>
                    </div>
                    <button
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      onClick={() => {
                        persistSelectedJob({
                          job_id: String(job.job_id),
                          title: job.title,
                          recommendation_id: recommendationId,
                        });
                        router.push("/pathway/majors");
                      }}
                    >
                      Select job
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 text-sm text-slate-600">
            Want to adjust your skills? <Link href="/dashboard" className="underline">Go back to Onboarding</Link>
          </div>
        </section>
      )}
    </div>
  );
}
