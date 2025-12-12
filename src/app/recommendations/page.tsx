"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RecommendationCard } from "@/components/recommendation-card";
import { SkillPicker, type SelectedSkill } from "@/components/skill-picker";
import { Button } from "@/components/ui/button";
import { recommendJobs } from "@/lib/backend-api";
import { fetchRecommendedPrograms } from "@/lib/api";
import { loadStoredProfile } from "@/lib/profile-storage";
import type { BackendJobRecommendation } from "@/types/api";
import type { ProgramFilters, ProgramRecommendation, ProgramSort, UserProfile } from "@/types";

const REGION_OPTIONS: Array<ProgramFilters["region"]> = ["all", "malaysia", "singapore", "global", "online"];
const STUDY_OPTIONS: Array<ProgramFilters["studyStyle"]> = ["all", "project", "research", "exam"];
const DIFFICULTY_OPTIONS: Array<ProgramFilters["difficulty"]> = ["all", "light", "medium", "heavy"];
const SORT_OPTIONS: ProgramSort[] = ["match", "math-first", "study-style"];

function formatScore(score: unknown): string {
  if (typeof score === "number" && Number.isFinite(score)) return score.toFixed(3);
  if (typeof score === "string" && score.trim()) {
    const parsed = Number(score);
    if (Number.isFinite(parsed)) return parsed.toFixed(3);
    return score;
  }
  return "N/A";
}

export default function RecommendationsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [programs, setPrograms] = useState<ProgramRecommendation[]>([]);
  const [filters, setFilters] = useState<ProgramFilters>({ region: "all", studyStyle: "all", difficulty: "all" });
  const [sort, setSort] = useState<ProgramSort>("match");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
  const [jobRecs, setJobRecs] = useState<BackendJobRecommendation[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsRequested, setJobsRequested] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("selected_skills_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const restored = parsed
        .filter((item) => item && typeof item.skill_key === "string" && typeof item.name === "string")
        .map((item) => ({ skill_key: item.skill_key as string, name: item.name as string }));
      setSelectedSkills(restored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("selected_skills_v1", JSON.stringify(selectedSkills));
  }, [selectedSkills]);

  useEffect(() => {
    setJobsRequested(false);
    setJobRecs([]);
    setJobsError(null);
  }, [selectedSkills]);

  useEffect(() => {
    setProfile(loadStoredProfile());
  }, []);

  const canFetch = Boolean(profile);

  const loadPrograms = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRecommendedPrograms(profile, { ...filters, sort });
      setPrograms(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load recommendations";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, [profile, filters, sort]);

  const profileSummary = useMemo(() => {
    if (!profile) return null;
    return {
      interests: profile.interests.join(", "),
      mathLevel: profile.mathLevel ? profile.mathLevel.toUpperCase() : "Unknown",
      csTaken: profile.csTaken ? "Yes" : "No",
      studyStyle: profile.studyStyle ?? "Not set",
    };
  }, [profile]);

  if (!profile) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Complete onboarding first</h1>
          <p className="mt-2 text-sm text-slate-600">
            We need your interests and math confidence to tailor recommendations.
          </p>
          <a href="/onboarding/steps/basic" className="mt-4 inline-flex rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
            Continue onboarding
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Powered by your onboarding data</p>
            <h1 className="text-3xl font-semibold text-slate-900">Program recommendations</h1>
          </div>
          {profileSummary && (
            <dl className="grid grid-cols-2 gap-4 text-sm text-slate-600">
              <div>
                <dt className="uppercase text-xs tracking-wide">Math level</dt>
                <dd className="font-semibold text-slate-900">{profileSummary.mathLevel}</dd>
              </div>
              <div>
                <dt className="uppercase text-xs tracking-wide">CS taken</dt>
                <dd className="font-semibold text-slate-900">{profileSummary.csTaken}</dd>
              </div>
              <div>
                <dt className="uppercase text-xs tracking-wide">Study style</dt>
                <dd className="font-semibold text-slate-900">{profileSummary.studyStyle}</dd>
              </div>
              <div className="col-span-2">
                <dt className="uppercase text-xs tracking-wide">Interests</dt>
                <dd className="font-semibold text-slate-900">{profileSummary.interests}</dd>
              </div>
            </dl>
          )}
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Job recommendations (Top 5)</h2>
            <p className="text-sm text-slate-600">Search skills, then request job recommendations from the backend.</p>
          </div>
          <Button
            onClick={async () => {
              setJobsLoading(true);
              setJobsRequested(true);
              setJobsError(null);
              try {
                const skill_keys = selectedSkills.map((s) => s.skill_key);
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
              {jobRecs.slice(0, 5).map((job) => (
                <li key={String(job.job_id)} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <Link href={`/jobs/${job.job_id}`} className="font-semibold text-slate-900 hover:underline">
                        {job.title}
                      </Link>
                      <div className="text-sm text-slate-600">
                        Source: {job.source ?? "Unknown"} · Matched: {job.matched_skills ?? 0} · Score: {formatScore(job.score)}
                      </div>
                    </div>
                    <Link href={`/jobs/${job.job_id}`} className="text-sm text-slate-700 hover:underline">
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

      <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
            <p className="text-sm text-slate-600">Adjust study style, region, or rigor to see different paths.</p>
          </div>
          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={loadPrograms}
            disabled={loading || !canFetch}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-sm text-slate-600">
            Region
            <select
              value={filters.region}
              onChange={(event) => setFilters((prev) => ({ ...prev, region: event.target.value as ProgramFilters["region"] }))}
              className="mt-1 w-full rounded-xl border px-3 py-2"
            >
              {REGION_OPTIONS.map((option) => (
                <option key={option} value={option ?? "all"}>
                  {option === "all" ? "All" : option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Study style
            <select
              value={filters.studyStyle}
              onChange={(event) => setFilters((prev) => ({ ...prev, studyStyle: event.target.value as ProgramFilters["studyStyle"] }))}
              className="mt-1 w-full rounded-xl border px-3 py-2"
            >
              {STUDY_OPTIONS.map((option) => (
                <option key={option} value={option ?? "all"}>
                  {option === "all" ? "All" : option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Difficulty
            <select
              value={filters.difficulty}
              onChange={(event) => setFilters((prev) => ({ ...prev, difficulty: event.target.value as ProgramFilters["difficulty"] }))}
              className="mt-1 w-full rounded-xl border px-3 py-2"
            >
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option} value={option ?? "all"}>
                  {option === "all" ? "All" : option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Sort by
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ProgramSort)}
              className="mt-1 w-full rounded-xl border px-3 py-2"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.replace("-", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <span>{error}</span>
            <button className="rounded-lg border border-red-400 px-3 py-1 text-xs font-semibold" onClick={loadPrograms}>
              Retry
            </button>
          </div>
        )}
      </section>

      {loading && (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Scoring programs...</div>
      )}

      {!loading && programs.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white/60 p-6 text-sm text-slate-500">
          No matches for the selected filters. Try relaxing the filters or update your interests.
        </div>
      )}

      <div className="grid gap-4">
        {programs.map((program) => (
          <RecommendationCard key={program.id} data={program} />
        ))}
      </div>
    </div>
  );
}
