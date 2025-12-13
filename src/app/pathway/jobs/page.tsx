"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { recommendJobs } from "@/lib/backend-api";
import { clearSelectedJob, clearSelectedMajor, saveSelectedJob } from "@/lib/pathway-storage";
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

function loadSelectedSkills(): SelectedSkill[] {
  try {
    const raw = localStorage.getItem("selected_skills_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.skill_key === "string" && typeof item.name === "string")
      .map((item) => ({ skill_key: item.skill_key as string, name: item.name as string }));
  } catch {
    return [];
  }
}

export default function PathwayJobsPage() {
  const router = useRouter();

  const [skills, setSkills] = useState<SelectedSkill[]>(() => loadSelectedSkills());
  const [jobs, setJobs] = useState<BackendJobRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // New flow always re-derives downstream selections from current skills.
    clearSelectedJob();
    clearSelectedMajor();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "selected_skills_v1") return;
      setSkills(loadSelectedSkills());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const skillKeys = useMemo(() => skills.map((s) => s.skill_key), [skills]);

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
        <p className="mt-2 text-sm text-slate-600">We recommend jobs based on your selected skills.</p>
        <div className="mt-4 text-sm text-slate-600">
          Using {skills.length} selected skill{skills.length === 1 ? "" : "s"}
        </div>
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
                <li key={String(job.job_id)} className="rounded-xl border p-4">
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
