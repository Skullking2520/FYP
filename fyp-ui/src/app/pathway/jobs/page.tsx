"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { recommendJobs } from "@/lib/backend-api";
import { clearSelectedMajor, loadSelectedJob, saveSelectedJob } from "@/lib/pathway-storage";
import { expandSkillKeysWithLevels, loadSelectedSkillsFromStorage, SELECTED_SKILLS_STORAGE_KEY } from "@/lib/skills-storage";
import type { BackendJobRecommendation } from "@/types/api";
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

  const [skills, setSkills] = useState<SelectedSkill[]>(() => loadSelectedSkillsFromStorage());
  const [targetJob, setTargetJob] = useState<string | null>(() => (typeof window === "undefined" ? null : loadUserTypedTargetJob()));
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() => (typeof window === "undefined" ? null : loadSelectedJob()?.job_id ?? null));
  const selectedJobTitle = useMemo(() => {
    if (typeof window === "undefined") return null;
    const stored = loadSelectedJob();
    return stored?.title ?? null;
  }, [selectedJobId]);
  const [jobs, setJobs] = useState<BackendJobRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    });

    recommendJobs(skillKeys)
      .then((data) => {
        if (cancelled) return;
        setJobs(Array.isArray(data) ? data : []);
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
  }, [skillKeys]);

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
          </div>
        )}

        {selectedJobId && (
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-700">
              Already selected: <span className="font-semibold text-slate-900">{selectedJobTitle ?? selectedJobId}</span>
            </div>
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                router.push("/pathway/majors");
              }}
            >
              No thanks, I’ll stick with this job
            </button>
          </div>
        )}
      </header>

      {skills.length === 0 && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-700">No skills selected yet.</div>
          <p className="mt-2 text-sm text-slate-600">Go to Dashboard and pick skills first, then come back here.</p>
          <div className="mt-4 flex gap-3">
            <Link href="/dashboard" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Go to dashboard
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
                        saveSelectedJob({ job_id: String(job.job_id), title: job.title });
                        setSelectedJobId(String(job.job_id));
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
            Want to adjust your skills? <Link href="/dashboard" className="underline">Go back to Dashboard</Link>
          </div>
        </section>
      )}
    </div>
  );
}
