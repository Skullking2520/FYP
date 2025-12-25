// src/app/onboarding/steps/academics/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useOnboarding } from "../../_components/OnboardingProvider";
import { Progress } from "../../_components/Progress";
import { StepNav } from "../../_components/StepNav";
import type { AcademicsLevel } from "@/lib/academics/subjects";

type SubjectRow = { name: string; grade: string };
type MappedSkill = { skill_key: string; level: number };

type GradeOption = { value: string; label: string };

const GRADE_OPTIONS: GradeOption[] = [
  { value: "A*", label: "A* (A Star): 90–100% (Outstanding)" },
  { value: "A", label: "A: 80–89% (Excellent)" },
  { value: "B", label: "B: 70–79% (Good)" },
  { value: "C", label: "C: 60–69% (Satisfactory)" },
  { value: "D", label: "D: 50–59% (Below Average/Pass)" },
  { value: "E", label: "E: 40–49% (Lowest Pass)" },
  { value: "U", label: "U: Ungraded (0–39%)" },
];

function getLevel(educationStage: string | null | undefined): AcademicsLevel {
  return educationStage?.startsWith("alevel") ? "alevel" : "olevel";
}

function deriveCsTaken(subjects: SubjectRow[]): boolean {
  const normalized = subjects.map((s) => s.name.trim().toLowerCase());
  return normalized.some((name) =>
    ["computer science", "computer studies", "ict", "information technology", "programming"].some((k) => name.includes(k)),
  );
}

function deriveMathLevel(subjects: SubjectRow[]): "low" | "mid" | "high" | null {
  const mathRow = subjects.find((s) => s.name.trim().toLowerCase().includes("math"));
  if (!mathRow) return null;
  const grade = mathRow.grade;
  if (grade === "A*" || grade === "A") return "high";
  if (grade === "B" || grade === "C") return "mid";
  if (grade) return "low";
  return null;
}

function buildDefaultSubjects(educationStage: string | null | undefined): SubjectRow[] {
  const base = educationStage?.startsWith("alevel")
    ? ["Mathematics", "Computer Science", "Physics"]
    : ["Mathematics", "English", "Science", "Computer Studies", "Additional Mathematics"];
  return base.map((name) => ({ name, grade: "" }));
}

export default function AcademicsStep() {
  const { data, setData } = useOnboarding();
  const educationStage = data.basic.educationStage;
  const level = useMemo(() => getLevel(educationStage), [educationStage]);
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [mappedSkills, setMappedSkills] = useState<MappedSkill[]>(() =>
    Array.isArray(data.academics.mappedSkills)
      ? (data.academics.mappedSkills as unknown[]).filter(
          (v): v is MappedSkill =>
            !!v && typeof v === "object" &&
            typeof (v as any).skill_key === "string" &&
            typeof (v as any).level === "number",
        )
      : [],
  );
  const [mappedSkillsLoading, setMappedSkillsLoading] = useState(false);
  const [mappedSkillsError, setMappedSkillsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSubjectsLoading(true);
    setSubjectsError(null);
    setSubjectOptions([]);

    (async () => {
      try {
        const res = await fetch(
          `/api/academics/subjects?stage=${encodeURIComponent(level)}&limit=200`,
          {
          method: "GET",
          headers: { accept: "application/json" },
          },
        );

        if (!res.ok) {
          let detail = `Request failed with status ${res.status}`;
          try {
            const body = (await res.json()) as unknown;
            if (body && typeof body === "object" && "detail" in body) {
              const maybeDetail = (body as Record<string, unknown>).detail;
              if (typeof maybeDetail === "string") detail = maybeDetail;
            }
          } catch {
            // ignore
          }
          throw new Error(detail);
        }

        const json = (await res.json()) as unknown;
        const subjects =
          json && typeof json === "object" && "subjects" in json && Array.isArray((json as any).subjects)
            ? ((json as any).subjects as unknown[]).filter((s) => typeof s === "string")
            : null;

        if (!subjects) throw new Error("Invalid subjects payload");

        if (!cancelled) {
          setSubjectOptions(subjects);
          setSubjectsError(null);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load subjects";
        setSubjectsError(message);
        setSubjectOptions([]);
      } finally {
        if (cancelled) return;
        setSubjectsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [level]);

  const initialSubjects = useMemo(() => {
    if (Array.isArray(data.academics.subjects) && data.academics.subjects.length > 0) {
      return data.academics.subjects.map((s) => ({
        name: typeof s?.name === "string" ? s.name : "",
        grade: typeof s?.grade === "string" ? s.grade : "",
      }));
    }
    return buildDefaultSubjects(data.basic.educationStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [subjects, setSubjects] = useState<SubjectRow[]>(initialSubjects);

  const hasCompleteSubjects = useMemo(() => {
    if (!subjects || subjects.length === 0) return false;
    return subjects.every((row) => row.name.trim().length > 0 && row.grade.trim().length > 0);
  }, [subjects]);

  useEffect(() => {
    if (!hasCompleteSubjects) {
      setMappedSkills([]);
      setMappedSkillsError(null);
      setMappedSkillsLoading(false);
      return;
    }

    let cancelled = false;
    setMappedSkillsLoading(true);
    setMappedSkillsError(null);

    (async () => {
      try {
        const results = await Promise.all(
          subjects.map(async (row) => {
            const subject = row.name.trim();
            const grade = row.grade.trim();
            const params = new URLSearchParams({
              stage: level,
              subject,
              grade,
            });

            // Uses Next.js catch-all proxy (/api/* -> upstream /api/*)
            const res = await fetch(`/api/education/subjects/mapped-skills?${params.toString()}`, {
              method: "GET",
              headers: { accept: "application/json" },
            });

            if (!res.ok) {
              let detail = `Request failed with status ${res.status}`;
              try {
                const body = (await res.json()) as unknown;
                if (body && typeof body === "object" && "detail" in body) {
                  const maybeDetail = (body as Record<string, unknown>).detail;
                  if (typeof maybeDetail === "string") detail = maybeDetail;
                }
              } catch {
                // ignore
              }
              throw new Error(detail);
            }

            const json = (await res.json()) as any;
            const skillsRaw = Array.isArray(json?.skills) ? (json.skills as any[]) : [];
            return skillsRaw
              .map((s) => ({ skill_key: String(s?.skill_key ?? ""), level: Number(s?.level ?? 0) }))
              .filter((s) => s.skill_key && Number.isFinite(s.level));
          }),
        );

        if (cancelled) return;

        const byKey = new Map<string, number>();
        for (const list of results) {
          for (const item of list) {
            const nextLevel = Math.max(0, Math.min(5, Math.round(item.level)));
            const prev = byKey.get(item.skill_key) ?? 0;
            if (nextLevel > prev) byKey.set(item.skill_key, nextLevel);
          }
        }

        const merged = Array.from(byKey.entries())
          .map(([skill_key, level]) => ({ skill_key, level }))
          .sort((a, b) => b.level - a.level)
          .slice(0, 50);

        setMappedSkills(merged);
        setMappedSkillsError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load mapped skills";
        setMappedSkillsError(message);
        setMappedSkills([]);
      } finally {
        if (cancelled) return;
        setMappedSkillsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasCompleteSubjects, level, subjects]);

  useEffect(() => {
    // Keep legacy fields updated for downstream logic (e.g., skill prefill / matching),
    // but do not ask them directly in the UI.
    const csTaken = deriveCsTaken(subjects);
    const mathLevel = deriveMathLevel(subjects);
    setData("academics", {
      ...data.academics,
      subjects,
      csTaken,
      mathLevel,
      mappedSkills,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, mappedSkills, setData]);

  const canNext = hasCompleteSubjects && !subjectsLoading && !subjectsError && !mappedSkillsLoading && !mappedSkillsError;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Academics</h1>
      <Progress index={1} />
      <div className="rounded-2xl bg-white border shadow-sm p-5 space-y-4">
        <div>
          <div className="text-sm font-medium mb-2">Subjects & grades</div>
          <div className="space-y-2">
            {subjects.map((row, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-3">
                <select
                  className="rounded-xl border bg-white px-3 py-2 md:col-span-2"
                  value={row.name}
                  disabled={subjectsLoading || subjectOptions.length === 0}
                  onChange={(e) => {
                    const next = [...subjects];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setSubjects(next);
                  }}
                >
                  <option value="">
                    {subjectsLoading ? "Loading subjects..." : "Select subject"}
                  </option>
                  {subjectOptions.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-xl border bg-white px-3 py-2"
                  value={row.grade}
                  onChange={(e) => {
                    const next = [...subjects];
                    next[idx] = { ...next[idx], grade: e.target.value };
                    setSubjects(next);
                  }}
                >
                  <option value="">Select grade</option>
                  {GRADE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-xl border"
              onClick={() => setSubjects([...subjects, { name: "", grade: "" }])}
              disabled={subjectsLoading || subjectOptions.length === 0}
            >
              + Add subject
            </button>
            {subjects.length > 0 && (
              <button
                type="button"
                className="px-3 py-2 rounded-xl border"
                onClick={() => setSubjects(subjects.slice(0, -1))}
              >
                − Remove last
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Education stage: {educationStage ?? "—"}. Please choose subjects and grades from the dropdowns.
          </p>
          {subjectsError && <p className="mt-2 text-xs text-red-600">Failed to load subjects: {subjectsError}</p>}
          {mappedSkillsLoading && <p className="mt-2 text-xs text-slate-500">Calculating mapped skills…</p>}
          {mappedSkillsError && (
            <p className="mt-2 text-xs text-red-600">Failed to map subjects to skills: {mappedSkillsError}</p>
          )}
        </div>
      </div>
      <StepNav prev="/onboarding/steps/basic" next="/onboarding/steps/about" canNext={canNext} />
    </div>
  );
}
