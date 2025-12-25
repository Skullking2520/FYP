"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SkillPicker, type SelectedSkill } from "@/components/skill-picker";
import { Button } from "@/components/ui/button";
import { recommendJobs } from "@/lib/backend-api";
import { expandSkillKeysWithLevels, loadSelectedSkillsFromStorage, saveSelectedSkillsToStorage } from "@/lib/skills-storage";
import type { BackendJobRecommendation } from "@/types/api";

function formatScore(score: unknown): string {
  if (typeof score === "number" && Number.isFinite(score)) return score.toFixed(3);
  if (typeof score === "string" && score.trim()) {
    const parsed = Number(score);
    if (Number.isFinite(parsed)) return parsed.toFixed(3);
    return score;
  }
  return "N/A";
}

function toBase64Url(input: string): string {
  // input is expected to be ASCII/UTF-8 safe (e.g., ESCO/ONET ids)
  const base64 = btoa(unescape(encodeURIComponent(input)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeJobIdForPath(jobId: unknown): string {
  return `b64_${toBase64Url(String(jobId))}`;
}

export default function RecommendationsPage() {
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>(() => loadSelectedSkillsFromStorage());
  const [jobRecs, setJobRecs] = useState<BackendJobRecommendation[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsRequested, setJobsRequested] = useState(false);

  useEffect(() => {
    saveSelectedSkillsToStorage(selectedSkills);
  }, [selectedSkills]);

  useEffect(() => {
    setJobsRequested(false);
    setJobRecs([]);
    setJobsError(null);
  }, [selectedSkills]);

  const sortedJobs = useMemo(() => {
    return [...jobRecs].sort((a, b) => {
      const aScore = typeof a.score === "number" ? a.score : Number(a.score);
      const bScore = typeof b.score === "number" ? b.score : Number(b.score);
      if (!Number.isFinite(aScore) && !Number.isFinite(bScore)) return 0;
      if (!Number.isFinite(aScore)) return 1;
      if (!Number.isFinite(bScore)) return -1;
      return bScore - aScore;
    });
  }, [jobRecs]);

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm uppercase tracking-wide text-slate-500">Similarity ranking</p>
        <h1 className="text-3xl font-semibold text-slate-900">Job recommendations</h1>
        <p className="mt-2 text-sm text-slate-600">Select skills, then request a ranked job list.</p>
      </header>

      <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ranked jobs</h2>
            <p className="text-sm text-slate-600">Sorted by similarity score (higher is better).</p>
          </div>
          <Button
            onClick={async () => {
              setJobsLoading(true);
              setJobsRequested(true);
              setJobsError(null);
              try {
                const skill_keys = expandSkillKeysWithLevels(selectedSkills);
                const result = await recommendJobs(skill_keys);
                setJobRecs(result);
              } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to recommend jobs";
                setJobsError(message);
                setJobRecs([]);
              } finally {
                setJobsLoading(false);
              }
            }}
            disabled={jobsLoading || selectedSkills.length === 0}
          >
            {jobsLoading ? "Recommending…" : "Recommend Jobs"}
          </Button>
        </div>

        <SkillPicker value={selectedSkills} onChange={setSelectedSkills} />

        {jobsError && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <span>{jobsError}</span>
            <button
              className="rounded-lg border border-red-400 px-3 py-1 text-xs font-semibold"
              onClick={() => setJobsError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {!jobsLoading && !jobsError && jobRecs.length > 0 && (
          <div className="space-y-3">
            <ul className="space-y-2">
              {sortedJobs.map((job) => (
                <li key={String(job.job_id)} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <Link
                        href={`/jobs/${encodeJobIdForPath(job.job_id)}`}
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        {job.title}
                      </Link>
                      <div className="text-sm text-slate-600">
                        Source: {job.source ?? "Unknown"} · Matched: {job.matched_skills ?? 0} · Score: {formatScore(job.score)}
                      </div>
                    </div>
                    <Link href={`/jobs/${encodeJobIdForPath(job.job_id)}`} className="text-sm text-slate-700 hover:underline">
                      View details
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!jobsLoading && !jobsError && jobRecs.length === 0 && (
          <div className="text-sm text-slate-500">
            {selectedSkills.length === 0
              ? "Select at least one skill to enable job recommendations."
              : jobsRequested
                ? "No job recommendations returned. Try different skills."
                : "Pick skills, then click Recommend Jobs."}
          </div>
        )}
      </section>

      <div className="text-sm text-slate-600">
        Want to change your skills? <Link className="underline" href="/dashboard">Go to dashboard</Link>
      </div>
    </div>
  );
}
