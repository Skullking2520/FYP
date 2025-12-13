"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { getJob, getJobMajors, getJobSkills, getMajorGaps } from "@/lib/backend-api";
import type { BackendJob, BackendJobSkill, BackendMajorRecommendation, BackendMajorSkill } from "@/types/api";

type Params = { job_id: string };

function getSkillDisplayName(skill: BackendJobSkill): string {
  return (
    (typeof skill.name === "string" && skill.name) ||
    (typeof skill.skill_name === "string" && skill.skill_name) ||
    (typeof skill.skill_key === "string" && skill.skill_key) ||
    "(unknown skill)"
  );
}

function getMajorSkillDisplayName(skill: BackendMajorSkill): string {
  return (
    (typeof skill.name === "string" && skill.name) ||
    (typeof skill.skill_name === "string" && skill.skill_name) ||
    (typeof skill.skill_key === "string" && skill.skill_key) ||
    "(unknown skill)"
  );
}

function formatScore(score: unknown): string {
  if (typeof score === "number" && Number.isFinite(score)) return score.toFixed(3);
  if (typeof score === "string" && score.trim()) {
    const parsed = Number(score);
    if (Number.isFinite(parsed)) return parsed.toFixed(3);
    return score;
  }
  return "N/A";
}

type SelectedSkill = { skill_key: string; name: string };

function loadSelectedSkillsFromStorage(): SelectedSkill[] {
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

export default function JobDetailPage({ params }: { params: Promise<Params> }) {
  const { job_id: jobId } = use(params);
  const [job, setJob] = useState<BackendJob | null>(null);
  const [skills, setSkills] = useState<BackendJobSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);

  const [majors, setMajors] = useState<BackendMajorRecommendation[]>([]);
  const [majorsLoading, setMajorsLoading] = useState(false);
  const [majorsError, setMajorsError] = useState<string | null>(null);

  const [selectedMajor, setSelectedMajor] = useState<BackendMajorRecommendation | null>(null);
  const [gaps, setGaps] = useState<BackendMajorSkill[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSkills(loadSelectedSkillsFromStorage());
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setJob(null);
      setSkills([]);
    });

    Promise.all([getJob(jobId), getJobSkills(jobId)])
      .then(([jobData, skillsData]) => {
        if (cancelled) return;
        setJob(jobData);
        setSkills(skillsData);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load job details";
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    setMajorsLoading(true);
    setMajorsError(null);
    setMajors([]);
    setSelectedMajor(null);
    setGaps([]);
    setGapsError(null);

    getJobMajors(jobId, 5)
      .then((data) => {
        if (cancelled) return;
        setMajors(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load major recommendations";
        setMajorsError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setMajorsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const title = useMemo(() => {
    if (!job) return "Job detail";
    return typeof job.title === "string" && job.title ? job.title : "Job detail";
  }, [job]);

  const description = useMemo(() => {
    const short = job?.short_description;
    if (typeof short === "string" && short.trim()) return short.trim();

    const full = job?.description;
    if (typeof full === "string" && full.trim()) return full.trim();

    return "No description available.";
  }, [job]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading job…</div>;
  }

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-slate-900">Failed to load</h1>
          <p className="mt-2 text-sm text-red-800">{error}</p>
          <div className="mt-4 flex gap-3">
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            <Link href="/recommendations" className="rounded-xl border px-4 py-2 text-sm">
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Job detail</p>
            <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-600">Job ID: {jobId}</p>
          </div>
          <Link href="/recommendations" className="text-sm text-slate-700 hover:underline">
            ← Back to recommendations
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Description</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
          {description}
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recommended majors (Top 5)</h2>
            <p className="mt-1 text-sm text-slate-600">Backend-driven major recommendations for this job.</p>
          </div>
          <div className="text-xs text-slate-500">
            Using {selectedSkills.length} selected skill{selectedSkills.length === 1 ? "" : "s"}
          </div>
        </div>

        {majorsLoading && <div className="mt-4 text-sm text-slate-500">Loading major recommendations…</div>}

        {majorsError && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <span>{majorsError}</span>
            <button
              className="rounded-lg border border-red-400 px-3 py-1 text-xs font-semibold"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        )}

        {!majorsLoading && !majorsError && majors.length === 0 && (
          <div className="mt-4 text-sm text-slate-500">No major recommendations available.</div>
        )}

        {!majorsLoading && !majorsError && majors.length > 0 && (
          <ul className="mt-4 space-y-2">
            {majors.slice(0, 5).map((major) => {
              const isSelected = selectedMajor?.major_id === major.major_id;
              return (
                <li key={String(major.major_id)} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{major.major_name}</div>
                      <div className="text-sm text-slate-600">
                        Matched: {major.matched_skills ?? 0} · Score: {formatScore(major.score)}
                      </div>
                    </div>
                    <button
                      className="rounded-xl border px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
                      onClick={async () => {
                        setSelectedMajor(major);
                        setGapsLoading(true);
                        setGapsError(null);
                        setGaps([]);
                        try {
                          const keys = selectedSkills.map((s) => s.skill_key);
                          const result = await getMajorGaps(String(major.major_id), keys);
                          setGaps(Array.isArray(result) ? result : []);
                        } catch (err) {
                          const message = err instanceof Error ? err.message : "Failed to load skill gaps";
                          setGapsError(message);
                        } finally {
                          setGapsLoading(false);
                        }
                      }}
                      disabled={gapsLoading && isSelected}
                    >
                      {isSelected ? (gapsLoading ? "Loading gaps…" : "View gaps") : "View gaps"}
                    </button>
                  </div>

                  {isSelected && (
                    <div className="mt-4 rounded-xl border bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">Missing Skills for this Major</h3>

                      {selectedSkills.length === 0 && (
                        <div className="mt-2 text-sm text-slate-600">
                          You have no selected skills yet. Go back to Recommendations to pick skills for a more accurate gap analysis.
                        </div>
                      )}

                      {gapsError && <div className="mt-2 text-sm text-red-700">{gapsError}</div>}

                      {!gapsLoading && !gapsError && gaps.length === 0 && (
                        <div className="mt-2 text-sm text-slate-600">You already meet the skill requirements.</div>
                      )}

                      {!gapsLoading && !gapsError && gaps.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {gaps.map((skill, idx) => {
                            const name = getMajorSkillDisplayName(skill);
                            const source = typeof skill.source === "string" && skill.source ? skill.source : "Unknown";
                            const importance = typeof skill.importance === "number" ? skill.importance : null;
                            return (
                              <li key={`${skill.skill_key ?? name}-${idx}`} className="rounded-lg border bg-white p-3">
                                <div className="font-medium text-slate-900">{name}</div>
                                <div className="text-sm text-slate-600">
                                  Source: {source}
                                  {importance !== null ? ` · Importance: ${importance}` : ""}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Skills</h2>
        <p className="mt-1 text-sm text-slate-600">
          If importance is available (ONET), it is shown. Otherwise we show relation/skill type.
        </p>

        {skills.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">No skills returned for this job.</div>
        ) : (
          <ul className="mt-4 space-y-2">
            {skills.map((skill, idx) => {
              const name = getSkillDisplayName(skill);
              const importance = typeof skill.importance === "number" ? skill.importance : null;
              const secondary =
                importance !== null
                  ? `Importance: ${importance}`
                  : `${skill.relation_type ?? "Unknown relation"} · ${skill.skill_type ?? "Unknown type"}`;

              return (
                <li key={`${skill.skill_key ?? name}-${idx}`} className="rounded-xl border p-4">
                  <div className="font-medium text-slate-900">{name}</div>
                  <div className="text-sm text-slate-600">{secondary}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
