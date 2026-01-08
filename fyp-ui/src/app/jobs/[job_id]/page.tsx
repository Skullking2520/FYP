"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { getJob, getJobMajors, getJobSkills, getMajorPrograms, resolveSkills } from "@/lib/backend-api";
import { formatSkillLabel, looksLikeUuid } from "@/lib/skills-storage";
import type { BackendJob, BackendJobSkill, BackendMajorProgramRanking, BackendMajorRecommendation } from "@/types/api";

type Params = { job_id: string };

function getSkillDisplayName(skill: BackendJobSkill): string {
  const rawName =
    (typeof skill.name === "string" && skill.name) ||
    (typeof skill.skill_name === "string" && skill.skill_name) ||
    null;
  const key = typeof skill.skill_key === "string" && skill.skill_key ? skill.skill_key : "";
  if (!rawName && !key) return "(unknown skill)";
  const label = formatSkillLabel(rawName, key || rawName || "");
  return label || "(unknown skill)";
}

export default function JobDetailPage({ params }: { params: Promise<Params> }) {
  const { job_id: jobId } = use(params);
  const decodedJobId = useMemo(() => {
    if (jobId.startsWith("b64_")) {
      const raw = jobId.slice("b64_".length);
      const padded = raw.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((raw.length + 3) % 4);
      try {
        return decodeURIComponent(escape(atob(padded)));
      } catch {
        // fall through to URL decode attempt
      }
    }
    try {
      return decodeURIComponent(jobId);
    } catch {
      return jobId;
    }
  }, [jobId]);
  const [job, setJob] = useState<BackendJob | null>(null);
  const [skills, setSkills] = useState<BackendJobSkill[]>([]);
  const [skillNameByKey, setSkillNameByKey] = useState<Record<string, string>>({});
  const [majors, setMajors] = useState<BackendMajorRecommendation[]>([]);
  const [majorsLoading, setMajorsLoading] = useState(false);
  const [majorsError, setMajorsError] = useState<string | null>(null);

  const [selectedMajor, setSelectedMajor] = useState<BackendMajorRecommendation | null>(null);
  const [programs, setPrograms] = useState<BackendMajorProgramRanking[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setJob(null);
      setSkills([]);
      setMajors([]);
      setMajorsError(null);
      setSelectedMajor(null);
      setPrograms([]);
      setProgramsError(null);
    });

    Promise.all([getJob(decodedJobId), getJobSkills(decodedJobId)])
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
  }, [decodedJobId]);

  useEffect(() => {
    const unresolved = skills
      .map((s) => {
        const k = typeof s.skill_key === "string" ? s.skill_key : "";
        const display = getSkillDisplayName(s);
        const needsResolve = display === "(unknown skill)" || looksLikeUuid(k);
        return k && !skillNameByKey[k] && needsResolve ? k : "";
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
      setSkillNameByKey((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {
        // ignore resolve failures
      });

    return () => {
      cancelled = true;
    };
  }, [skillNameByKey, skills]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setMajorsLoading(true);
      setMajorsError(null);
      setMajors([]);
    });

    getJobMajors(decodedJobId, 5)
      .then((data) => {
        if (cancelled) return;
        setMajors(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load courses";
        setMajorsError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setMajorsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [decodedJobId]);

  useEffect(() => {
    if (!selectedMajor) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setProgramsLoading(true);
      setProgramsError(null);
      setPrograms([]);
    });

    getMajorPrograms(String(selectedMajor.major_id), 5)
      .then((data) => {
        if (cancelled) return;
        setPrograms(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load top courses";
        setProgramsError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setProgramsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMajor]);

  const title = useMemo(() => {
    if (!job) return "Job detail";
    return typeof job.title === "string" && job.title ? job.title : "Job detail";
  }, [job]);

  const description = useMemo(() => {
    const short = job?.short_description;
    if (typeof short === "string" && short.trim()) return short.trim();

    const full = job?.description;
    if (typeof full === "string" && full.trim()) return full.trim();

    return "No description available from the current backend for this job.";
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
            <p className="mt-2 text-sm text-slate-600">Job ID: {decodedJobId}</p>
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
        {!job && (
          <p className="mt-3 text-sm text-slate-600">
            If you still see this message, the backend may not expose a job-detail endpoint. The related majors below can still load.
          </p>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Skills</h2>
        <p className="mt-1 text-sm text-slate-600">
          If importance is available (ONET), it is shown. Otherwise we show relation/skill type.
        </p>

        {skills.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">No skills returned for this job (or the endpoint is unavailable).</div>
        ) : (
          <ul className="mt-4 space-y-2">
            {skills.map((skill, idx) => {
              const key = typeof skill.skill_key === "string" ? skill.skill_key : "";
              const name = (key && skillNameByKey[key]) || getSkillDisplayName(skill);
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

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Majors</h2>
        <p className="mt-1 text-sm text-slate-600">Pick a major to see top matching programs.</p>

        {majorsLoading && <div className="mt-4 text-sm text-slate-500">Loading majors…</div>}
        {majorsError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{majorsError}</div>}

        {!majorsLoading && !majorsError && majors.length === 0 && (
          <div className="mt-4 text-sm text-slate-500">No majors returned for this job.</div>
        )}

        {!majorsLoading && !majorsError && majors.length > 0 && (
          <ul className="mt-4 space-y-2">
            {majors.map((m) => {
              const isSelected = selectedMajor ? String(selectedMajor.major_id) === String(m.major_id) : false;
              return (
                <li key={String(m.major_id)} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{m.major_name}</div>
                      <div className="text-sm text-slate-600">Matched: {m.matched_skills ?? 0} · Score: {m.score}</div>
                    </div>
                    <button
                      className="rounded-xl border px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
                      disabled={programsLoading && isSelected}
                      onClick={() => setSelectedMajor(m)}
                    >
                      {isSelected ? "Selected" : "View top programs"}
                    </button>
                  </div>

                  {isSelected && (
                    <div className="mt-4">
                      {programsLoading && <div className="text-sm text-slate-500">Loading top programs…</div>}
                      {programsError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{programsError}</div>}
                      {!programsLoading && !programsError && programs.length === 0 && (
                        <div className="text-sm text-slate-500">No program list returned.</div>
                      )}
                      {!programsLoading && !programsError && programs.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-3">Program</th>
                                <th className="px-4 py-3">University</th>
                                <th className="px-4 py-3">Rank</th>
                                <th className="px-4 py-3">Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {programs.map((p) => (
                                <tr key={String(p.program_id)} className="border-t">
                                  <td className="px-4 py-3 font-medium text-slate-900">{p.program_name}</td>
                                  <td className="px-4 py-3 text-slate-700">{p.university_name}</td>
                                  <td className="px-4 py-3 text-slate-700">
                                    {typeof p.rank_position === "number" ? `#${p.rank_position}` : p.rank_band ?? "—"}
                                  </td>
                                  <td className="px-4 py-3 text-slate-700">{p.score}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
