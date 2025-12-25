"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GapAnalysisCard } from "@/components/gap-analysis-card";
import { SkillResourceCard } from "@/components/skill-resource-card";
import { getResourcesForSkills } from "@/data/resources";
import { fetchProgramDetail, fetchUniversityProgram } from "@/lib/api";
import { analyzeGaps, userSkillKeywords } from "@/lib/match";
import { loadStoredProfile } from "@/lib/profile-storage";
import type { Program, ProgramId, UniversityId, UniversityProgram, UserProfile } from "@/types";

type Params = { id: ProgramId; uid: UniversityId };

export default function UniDetail({ params }: { params: Promise<Params> }) {
  const { id, uid } = use(params);
  const router = useRouter();
  const [university, setUniversity] = useState<UniversityProgram | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [profile] = useState<UserProfile | null>(() => (typeof window === "undefined" ? null : loadStoredProfile()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
    });
    Promise.all([fetchUniversityProgram(id, uid), fetchProgramDetail(id)])
      .then(([uni, prog]) => {
        if (!active) return;
        if (!uni || !prog) {
          setError("No university data available");
          setUniversity(null);
          setProgram(prog ?? null);
          return;
        }
        setUniversity(uni);
        setProgram(prog);
      })
      .catch(() => {
        if (active) setError("Failed to load university data");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, uid]);

  const userSkills = useMemo(() => (profile ? userSkillKeywords(profile) : []), [profile]);
  const gap = useMemo(() => {
    if (!university) return { missing: [], covered: [] };
    return analyzeGaps(university.requiredSkills, userSkills);
  }, [university, userSkills]);
  const resources = useMemo(() => getResourcesForSkills(gap.missing), [gap.missing]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading university details...</div>;
  }

  if (error || !university || !program) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-sm text-red-600">{error ?? "University unavailable"}</p>
        <button className="rounded-xl border px-4 py-2 text-sm" onClick={() => router.back()}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm uppercase tracking-wide text-slate-500">{program.name}</p>
        <h1 className="text-3xl font-semibold text-slate-900">{university.uniName}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Rank {university.rank ? `#${university.rank}` : "unlisted"} · {university.region}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full border px-3 py-1">{university.studyStyle} study style</span>
          <span className="rounded-full border px-3 py-1">{university.difficulty} workload</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={university.programUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Visit course page
          </a>
          <Link href={`/program/${program.id}`} className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-900">
            Back to program
          </Link>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Skill gap analysis</h2>
          <p className="text-sm text-slate-600">
            Based on your onboarding profile compared against {university.uniName} requirements.
          </p>
        </div>
        <GapAnalysisCard missing={gap.missing} covered={gap.covered} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Required skills</h2>
          <p className="text-sm text-slate-600">Review what this university emphasizes before applying.</p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {university.requiredSkills.map((skill) => (
            <li key={skill} className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700">
              {skill}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Entry requirements</h2>
        </div>
        <ul className="space-y-2 text-sm text-slate-700">
          {university.entryRequirements.map((req) => (
            <li key={req} className="rounded-2xl border bg-white px-4 py-3">
              {req}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Resources for your gaps</h2>
          <p className="text-sm text-slate-600">Curated materials mapped to missing skills.</p>
        </div>
        {resources.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white/60 p-5 text-sm text-slate-500">
            No gaps detected. Keep practicing to stay ahead.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <SkillResourceCard key={`${resource.skill}-${resource.title}`} resource={resource} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
