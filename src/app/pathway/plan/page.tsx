"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SkillResourceCard } from "@/components/skill-resource-card";
import { getMajorGaps, getMajorPrograms, getSkillResources } from "@/lib/backend-api";
import { loadSelectedJob, loadSelectedMajor } from "@/lib/pathway-storage";
import type { BackendMajorProgramRanking, BackendMajorSkill, BackendSkillResource } from "@/types/api";
import type { SkillResource } from "@/types";
import type { SelectedSkill } from "@/components/skill-picker";

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

function getMajorSkillDisplayName(skill: BackendMajorSkill): string {
  return (
    (typeof skill.name === "string" && skill.name) ||
    (typeof skill.skill_key === "string" && skill.skill_key) ||
    "(unknown skill)"
  );
}

function mapResource(resource: BackendSkillResource, skillName: string): SkillResource {
  return {
    skill: skillName,
    title: resource.title,
    provider: resource.provider,
    url: resource.url,
  };
}

export default function PathwayPlanPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState<string | undefined>(undefined);

  const [majorId, setMajorId] = useState<string | null>(null);
  const [majorName, setMajorName] = useState<string | undefined>(undefined);

  const [skills, setSkills] = useState<SelectedSkill[]>([]);

  const skillKeys = useMemo(() => skills.map((s) => s.skill_key), [skills]);

  const [programs, setPrograms] = useState<BackendMajorProgramRanking[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programsError, setProgramsError] = useState<string | null>(null);

  const [gaps, setGaps] = useState<BackendMajorSkill[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);

  const [selectedGapSkill, setSelectedGapSkill] = useState<BackendMajorSkill | null>(null);
  const [resources, setResources] = useState<BackendSkillResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);

  useEffect(() => {
    const job = loadSelectedJob();
    const major = loadSelectedMajor();
    queueMicrotask(() => {
      setJobId(job?.job_id ?? null);
      setJobTitle(job?.title);
      setMajorId(major?.major_id ?? null);
      setMajorName(major?.major_name);
      setSkills(loadSelectedSkills());
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key === "selected_skills_v1") {
        setSkills(loadSelectedSkills());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!majorId) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setProgramsLoading(true);
      setProgramsError(null);
      setPrograms([]);
    });

    getMajorPrograms(majorId, 10)
      .then((data) => {
        if (cancelled) return;
        setPrograms(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load program rankings";
        setProgramsError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setProgramsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [majorId]);

  useEffect(() => {
    if (!majorId) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setGapsLoading(true);
      setGapsError(null);
      setGaps([]);
      setSelectedGapSkill(null);
      setResources([]);
      setResourcesError(null);
    });

    getMajorGaps(majorId, skillKeys)
      .then((data) => {
        if (cancelled) return;
        setGaps(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load missing skills";
        setGapsError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setGapsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [majorId, skillKeys]);

  const selectedSkillName = useMemo(() => {
    const name = selectedGapSkill ? getMajorSkillDisplayName(selectedGapSkill) : null;
    return name;
  }, [selectedGapSkill]);

  const resourceCards = useMemo(() => {
    if (!selectedSkillName) return [];
    return resources.map((r) => mapResource(r, selectedSkillName));
  }, [resources, selectedSkillName]);

  const canRender = Boolean(jobId && majorId);

  if (!canRender) {
    return (
      <div className="space-y-6 p-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-slate-500">Step 3</p>
          <h1 className="text-2xl font-semibold text-slate-900">Your pathway</h1>
        </header>
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-700">Missing selection(s).</div>
          <p className="mt-2 text-sm text-slate-600">Please select a job and a major first.</p>
          <div className="mt-4 flex gap-3">
            <Link href="/pathway/jobs" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Go to job selection
            </Link>
            <Link href="/pathway/majors" className="rounded-xl border px-4 py-2 text-sm">
              Go to major selection
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Step 3</p>
            <h1 className="text-2xl font-semibold text-slate-900">Your pathway</h1>
            <p className="mt-2 text-sm text-slate-600">Program rankings and skill gaps for your selected major.</p>
            <p className="mt-1 text-sm text-slate-500">Job: {jobTitle ?? jobId}</p>
            <p className="mt-1 text-sm text-slate-500">Major: {majorName ?? majorId}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/pathway/majors" className="text-sm text-slate-700 hover:underline">
              ← Back
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Top programs for this major</h2>

        {programsLoading && <div className="mt-4 text-sm text-slate-500">Loading program rankings…</div>}
        {programsError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{programsError}</div>}

        {!programsLoading && !programsError && programs.length === 0 && (
          <div className="mt-4 text-sm text-slate-500">No program rankings available.</div>
        )}

        {!programsLoading && !programsError && programs.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">University</th>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Score</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={String(p.program_id)} className="border-t">
                    <td className="px-4 py-4 font-medium text-slate-900">{p.program_name}</td>
                    <td className="px-4 py-4 text-slate-700">{p.university_name}</td>
                    <td className="px-4 py-4 text-slate-700">
                      {typeof p.rank_position === "number" ? `#${p.rank_position}` : p.rank_band ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-slate-700">{p.ranking_source ?? "—"}</td>
                    <td className="px-4 py-4 text-slate-700">{p.ranking_year ?? "—"}</td>
                    <td className="px-4 py-4 text-slate-700">{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Missing Skills for this Major</h2>
        <p className="mt-1 text-sm text-slate-600">Click a missing skill to see learning resources.</p>

        {gapsLoading && <div className="mt-4 text-sm text-slate-500">Loading missing skills…</div>}
        {gapsError && <div className="mt-4 text-sm text-red-700">{gapsError}</div>}

        {!gapsLoading && !gapsError && gaps.length === 0 && (
          <div className="mt-4 text-sm text-slate-600">You already meet the skill requirements</div>
        )}

        {!gapsLoading && !gapsError && gaps.length > 0 && (
          <ul className="mt-4 space-y-2">
            {gaps.map((skill, idx) => {
              const name = getMajorSkillDisplayName(skill);
              const isSelected =
                typeof selectedGapSkill?.skill_key === "string" &&
                typeof skill.skill_key === "string" &&
                selectedGapSkill.skill_key === skill.skill_key;
              return (
                <li key={`${skill.skill_key ?? name}-${idx}`} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{name}</div>
                      <div className="text-sm text-slate-600">
                        Source: {typeof skill.source === "string" && skill.source ? skill.source : "Unknown"}
                        {typeof skill.dimension === "string" && skill.dimension ? ` · Dimension: ${skill.dimension}` : ""}
                        {typeof skill.importance === "number" ? ` · Importance: ${skill.importance}` : ""}
                      </div>
                    </div>
                    <button
                      className="rounded-xl border px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
                      disabled={resourcesLoading && isSelected}
                      onClick={async () => {
                        setSelectedGapSkill(skill);
                        setResources([]);
                        setResourcesError(null);
                        setResourcesLoading(true);
                        try {
                          const key = typeof skill.skill_key === "string" ? skill.skill_key : "";
                          const result = await getSkillResources(key, 10);
                          setResources(Array.isArray(result) ? result : []);
                        } catch (err) {
                          const message = err instanceof Error ? err.message : "Failed to load resources";
                          setResourcesError(message);
                        } finally {
                          setResourcesLoading(false);
                        }
                      }}
                    >
                      {isSelected ? (resourcesLoading ? "Loading…" : "View resources") : "View resources"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedGapSkill && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Learning resources</h2>
          <p className="mt-1 text-sm text-slate-600">For: {selectedSkillName}</p>

          {resourcesError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{resourcesError}</div>}
          {resourcesLoading && <div className="mt-4 text-sm text-slate-500">Loading resources…</div>}

          {!resourcesLoading && !resourcesError && resourceCards.length === 0 && (
            <div className="mt-4 text-sm text-slate-500">No learning resources available.</div>
          )}

          {!resourcesLoading && !resourcesError && resourceCards.length > 0 && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {resourceCards.map((resource) => (
                <SkillResourceCard key={`${resource.skill}-${resource.title}`} resource={resource} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
