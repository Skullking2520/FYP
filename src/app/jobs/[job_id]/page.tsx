"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { getJob, getJobSkills } from "@/lib/backend-api";
import type { BackendJob, BackendJobSkill } from "@/types/api";

type Params = { job_id: string };

function getSkillDisplayName(skill: BackendJobSkill): string {
  return (
    (typeof skill.name === "string" && skill.name) ||
    (typeof skill.skill_name === "string" && skill.skill_name) ||
    (typeof skill.skill_key === "string" && skill.skill_key) ||
    "(unknown skill)"
  );
}

export default function JobDetailPage({ params }: { params: Promise<Params> }) {
  const { job_id: jobId } = use(params);
  const [job, setJob] = useState<BackendJob | null>(null);
  const [skills, setSkills] = useState<BackendJobSkill[]>([]);
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
