// src/app/onboarding/steps/academics/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useOnboarding } from "../../_components/OnboardingProvider";
import { Progress } from "../../_components/Progress";
import { StepNav } from "../../_components/StepNav";
import type { AcademicsLevel } from "@/lib/academics/subjects";
import { normalizeSkillKey, quantizeSkillLevel } from "@/lib/skills-storage";

type PlainSubjectRow = { name: string; grade: string };
type MappedSkill = { skill_key: string; level: number };

type GradeOption = { value: string; label: string };

const GRADE_OPTIONS: GradeOption[] = [
  { value: "A*", label: "A* (A Star): 90–100% (Outstanding)" },
  { value: "A+", label: "A+ (treated as A*)" },
  { value: "A", label: "A: 80–89% (Excellent)" },
  { value: "B", label: "B: 70–79% (Good)" },
  { value: "C", label: "C: 60–69% (Satisfactory)" },
  { value: "D", label: "D: 50–59% (Below Average/Pass)" },
  { value: "E", label: "E: 40–49% (Lowest Pass)" },
  { value: "U", label: "U: Ungraded (0–39%)" },
];

function normalizeGradeValue(raw: string): string {
  const g = raw.trim().toUpperCase();
  if (!g) return "";

  // Common variants
  if (g === "A+") return "A*";
  if (g === "A STAR" || g === "ASTAR" || g === "A-STAR") return "A*";

  // Percentage inputs (e.g., 85, 85%, 85.0)
  const pctMatch = g.match(/^(\d{1,3})(?:\.(\d+))?\s*%?$/);
  if (pctMatch) {
    const value = Number(`${pctMatch[1]}${pctMatch[2] ? "." + pctMatch[2] : ""}`);
    if (Number.isFinite(value)) {
      if (value >= 90) return "A*";
      if (value >= 80) return "A";
      if (value >= 70) return "B";
      if (value >= 60) return "C";
      if (value >= 50) return "D";
      if (value >= 40) return "E";
      return "U";
    }
  }

  if (["A*", "A", "B", "C", "D", "E", "U"].includes(g)) return g;
  return "";
}

function getLevel(educationStage: string | null | undefined): AcademicsLevel {
  return educationStage?.startsWith("alevel") ? "alevel" : "olevel";
}

function isEducationStage(value: unknown): value is
  | "alevel_done"
  | "alevel_in_progress"
  | "olevel_done"
  | "olevel_in_progress"
  | null {
  return (
    value === null ||
    value === "alevel_done" ||
    value === "alevel_in_progress" ||
    value === "olevel_done" ||
    value === "olevel_in_progress"
  );
}

function isMeaningfulRow(row: PlainSubjectRow): boolean {
  return row.name.trim().length > 0 || row.grade.trim().length > 0;
}

function normalizeRows(rows: PlainSubjectRow[]): PlainSubjectRow[] {
  return rows
    .map((r) => ({ name: typeof r?.name === "string" ? r.name : "", grade: typeof r?.grade === "string" ? r.grade : "" }))
    .filter(isMeaningfulRow);
}

function normalizeSubjectName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function gradeRank(grade: string): number {
  // Higher is better.
  switch (normalizeGradeValue(grade)) {
    case "A*":
      return 7;
    case "A":
      return 6;
    case "B":
      return 5;
    case "C":
      return 4;
    case "D":
      return 3;
    case "E":
      return 2;
    case "U":
      return 1;
    default:
      return 0;
  }
}

function dedupeRowsBySubjectName(rows: PlainSubjectRow[]): PlainSubjectRow[] {
  const bestByName = new Map<string, PlainSubjectRow>();
  for (const row of rows) {
    const key = normalizeSubjectName(row.name);
    if (!key) continue;
    const prev = bestByName.get(key);
    if (!prev) {
      bestByName.set(key, row);
      continue;
    }
    // Keep the row with the better grade (or the later one if equal).
    if (gradeRank(row.grade) >= gradeRank(prev.grade)) bestByName.set(key, row);
  }
  return Array.from(bestByName.values());
}

function coerceArrayFromKeys(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const maybe = record[key];
    if (Array.isArray(maybe)) return maybe;
  }
  return [];
}

function toNumberOrZero(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function deriveCsTaken(subjects: PlainSubjectRow[]): boolean {
  const normalized = subjects.map((s) => s.name.trim().toLowerCase());
  return normalized.some((name) =>
    ["computer science", "computer studies", "ict", "information technology", "programming"].some((k) => name.includes(k)),
  );
}

function deriveMathLevel(subjects: PlainSubjectRow[], educationStage: string | null | undefined): "low" | "mid" | "high" | null {
  const normalizedNames = subjects.map((s) => s.name.trim().toLowerCase());
  const hasMath = normalizedNames.some((n) => n.includes("math"));
  if (!hasMath) return null;

  // Prefer grade-based inference if we have it.
  const mathRowWithGrade = subjects.find((s) => s.name.trim().toLowerCase().includes("math") && s.grade.trim().length > 0);
  if (mathRowWithGrade) {
    const grade = mathRowWithGrade.grade.trim();
    if (grade === "A*" || grade === "A") return "high";
    if (grade === "B" || grade === "C") return "mid";
    if (grade) return "low";
  }

  // No grades (in-progress): apply a conservative heuristic.
  const hasAdvancedMath = normalizedNames.some((n) => n.includes("additional mathematics") || n.includes("further mathematics"));
  if (hasAdvancedMath) return "high";
  if (educationStage?.startsWith("alevel")) return "mid";
  return "low";
}

function buildDefaultOlevelRows(): PlainSubjectRow[] {
  return ["Mathematics", "English", "Science", "Computer Studies", "Additional Mathematics"].map((name) => ({ name, grade: "" }));
}

function buildDefaultAlevelRows(): PlainSubjectRow[] {
  return ["Mathematics", "Computer Science", "Physics"].map((name) => ({ name, grade: "" }));
}

function coerceStoredRows(raw: unknown): PlainSubjectRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      if (!s || typeof s !== "object") return { name: "", grade: "" };
      const record = s as Record<string, unknown>;
      return {
        name: typeof record.name === "string" ? record.name : "",
        grade: typeof record.grade === "string" ? record.grade : "",
      };
    })
    .filter(isMeaningfulRow);
}

function splitLegacySubjects(raw: unknown, educationStage: string | null | undefined): { olevel: PlainSubjectRow[]; alevel: PlainSubjectRow[] } {
  // Legacy storage kept a single `subjects` array. We interpret it as the current level.
  const rows = coerceStoredRows(raw);
  const level = getLevel(educationStage);
  if (level === "alevel") return { olevel: [], alevel: rows };
  return { olevel: rows, alevel: [] };
}

export default function AcademicsStep() {
  const { data, setData } = useOnboarding();
  const educationStage = isEducationStage(data.basic.educationStage) ? data.basic.educationStage : null;

  const needsOlevelSection = true;
  const needsAlevelSection = educationStage?.startsWith("alevel") ?? false;

  const needOlevelGrades = educationStage === "olevel_done" || educationStage === "alevel_in_progress" || educationStage === "alevel_done";
  const needAlevelGrades = educationStage === "alevel_done";

  // When grades are not available (in progress), assume a baseline grade.
  // This lets us still compute mapped skills and downstream scoring.
  const DEFAULT_GRADE_IN_PROGRESS = "C";

  // O-level scores should not dominate A-level; even perfect O-level should be treated around A-level "B".
  // Our mapped skill levels are 0..10, so we cap O-level contributions to a mid level.
  const OLEVEL_MAX_LEVEL = 6;

  function normalizeMappedLevel(raw: number): number {
    // Backend mapping historically returned 0..5; we scale to 0..10 for finer control.
    // If backend already returns 0..10, scaling still stays within cap.
    const scaled = raw <= 5 ? raw * 2 : raw;
    return quantizeSkillLevel(scaled);
  }

  const [olevelOptions, setOlevelOptions] = useState<string[]>([]);
  const [alevelOptions, setAlevelOptions] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [mappedSkills, setMappedSkills] = useState<MappedSkill[]>(() =>
    Array.isArray(data.academics.mappedSkills)
      ? (data.academics.mappedSkills as unknown[]).filter(
          (v): v is MappedSkill =>
            !!v && typeof v === "object" &&
            typeof (v as Record<string, unknown>).skill_key === "string" &&
            typeof (v as Record<string, unknown>).level === "number",
        )
      : [],
  );
  const [mappedSkillsLoading, setMappedSkillsLoading] = useState(false);
  const [mappedSkillsError, setMappedSkillsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSubjectsLoading(true);
    setSubjectsError(null);
    setOlevelOptions([]);
    setAlevelOptions([]);

    const fetchSubjects = async (level: AcademicsLevel) => {
      const res = await fetch(`/api/academics/subjects?stage=${encodeURIComponent(level)}&limit=200`, {
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

      const json = (await res.json()) as unknown;
      const subjects = (() => {
        if (!json || typeof json !== "object") return null;
        const raw = (json as Record<string, unknown>).subjects;
        if (!Array.isArray(raw)) return null;
        return (raw as unknown[]).filter((s): s is string => typeof s === "string");
      })();

      if (!subjects) throw new Error("Invalid subjects payload");
      return subjects;
    };

    (async () => {
      try {
        const olevel = needsOlevelSection ? await fetchSubjects("olevel") : [];
        const alevel = needsAlevelSection ? await fetchSubjects("alevel") : [];
        if (cancelled) return;
        setOlevelOptions(olevel);
        setAlevelOptions(alevel);
        setSubjectsError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load subjects";
        setSubjectsError(message);
        setOlevelOptions([]);
        setAlevelOptions([]);
      } finally {
        if (cancelled) return;
        setSubjectsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsAlevelSection, needsOlevelSection]);

  const { initialOlevel, initialAlevel } = useMemo(() => {
    const stored = Array.isArray(data.academics.subjects) ? data.academics.subjects : [];
    // New schema: [{level,name,grade}]
    const hasLevel = stored.some((s) => {
      if (!s || typeof s !== "object") return false;
      const level = (s as Record<string, unknown>).level;
      return level === "olevel" || level === "alevel";
    });
    if (hasLevel) {
      const olevel = stored
        .filter((s) => (s && typeof s === "object" ? (s as Record<string, unknown>).level === "olevel" : false))
        .map((s) => {
          const record = s as Record<string, unknown>;
          return {
            name: typeof record.name === "string" ? record.name : "",
            grade: typeof record.grade === "string" ? record.grade : "",
          };
        })
        .filter(isMeaningfulRow);
      const alevel = stored
        .filter((s) => (s && typeof s === "object" ? (s as Record<string, unknown>).level === "alevel" : false))
        .map((s) => {
          const record = s as Record<string, unknown>;
          return {
            name: typeof record.name === "string" ? record.name : "",
            grade: typeof record.grade === "string" ? record.grade : "",
          };
        })
        .filter(isMeaningfulRow);
      return {
        initialOlevel: olevel.length > 0 ? olevel : buildDefaultOlevelRows(),
        initialAlevel: alevel.length > 0 ? alevel : (needsAlevelSection ? buildDefaultAlevelRows() : []),
      };
    }

    // Legacy schema: subjects = [{name,grade}] for the current level only.
    const legacy = splitLegacySubjects(data.academics.subjects, educationStage);
    return {
      initialOlevel: legacy.olevel.length > 0 ? legacy.olevel : buildDefaultOlevelRows(),
      initialAlevel: legacy.alevel.length > 0 ? legacy.alevel : (needsAlevelSection ? buildDefaultAlevelRows() : []),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [olevelRows, setOlevelRows] = useState<PlainSubjectRow[]>(initialOlevel);
  const [alevelRows, setAlevelRows] = useState<PlainSubjectRow[]>(initialAlevel);

  const normalizedOlevel = useMemo(() => normalizeRows(olevelRows), [olevelRows]);
  const normalizedAlevel = useMemo(() => normalizeRows(alevelRows), [alevelRows]);

  const olevelComplete = useMemo(() => {
    if (normalizedOlevel.length === 0) return false;
    return normalizedOlevel.every((row) => row.name.trim().length > 0 && (!needOlevelGrades || row.grade.trim().length > 0));
  }, [normalizedOlevel, needOlevelGrades]);

  const alevelComplete = useMemo(() => {
    if (!needsAlevelSection) return true;
    if (normalizedAlevel.length === 0) return false;
    return normalizedAlevel.every((row) => row.name.trim().length > 0 && (!needAlevelGrades || row.grade.trim().length > 0));
  }, [normalizedAlevel, needsAlevelSection, needAlevelGrades]);

  useEffect(() => {
    // Always map skills once the relevant section is complete.
    // If grades are not being collected yet, we use a default grade (C) to get a reasonable baseline.
    const shouldMapOlevel = olevelComplete;
    const shouldMapAlevel = needsAlevelSection && alevelComplete;

    if (!shouldMapOlevel && !shouldMapAlevel) {
      setMappedSkills([]);
      setMappedSkillsError(null);
      setMappedSkillsLoading(false);
      return;
    }

    let cancelled = false;
    setMappedSkillsLoading(true);
    setMappedSkillsError(null);

    const mapRows = async (stage: AcademicsLevel, rows: PlainSubjectRow[]) => {
      const results = await Promise.all(
        rows.map(async (row) => {
          const subject = row.name.trim();
          const normalizedGrade = normalizeGradeValue(row.grade);
          const grade = normalizedGrade || (row.grade.trim().length > 0 ? DEFAULT_GRADE_IN_PROGRESS : DEFAULT_GRADE_IN_PROGRESS);
          const params = new URLSearchParams({ stage, subject, grade });

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

          const json = (await res.json()) as unknown;
          const skillsRaw = coerceArrayFromKeys(json, [
            "skills",
            "items",
            "results",
            "data",
            "value",
            "mappedSkills",
            "mapped_skills",
          ]);

          const parsed = skillsRaw
            .map((s) => {
              if (typeof s === "string") {
                return { skill_key: normalizeSkillKey(s), level: 0 };
              }

              if (!s || typeof s !== "object") return { skill_key: "", level: NaN };
              const record = s as Record<string, unknown>;

              const skill_key_raw =
                typeof record.skill_key === "string"
                  ? record.skill_key
                  : typeof record.skillKey === "string"
                    ? record.skillKey
                    : typeof record.key === "string"
                      ? record.key
                      : typeof record.skill === "string"
                        ? record.skill
                        : String(record.skill_key ?? record.skillKey ?? record.key ?? record.skill ?? "");

              const skill_key = normalizeSkillKey(skill_key_raw);
              const level = toNumberOrZero(record.level ?? record.score ?? record.value);
              return { skill_key, level };
            })
            .filter((s) => s.skill_key && Number.isFinite(s.level));

          // UX requirement: 1 subject -> 1 mapped skill.
          // Pick the strongest match by normalized level.
          if (parsed.length === 0) return [];
          let best = parsed[0];
          let bestLevel = normalizeMappedLevel(best.level);
          for (const item of parsed.slice(1)) {
            const lvl = normalizeMappedLevel(item.level);
            if (lvl > bestLevel) {
              best = item;
              bestLevel = lvl;
            }
          }
          return [best];
        }),
      );

      return results.flat();
    };

    (async () => {
      try {
        const dedupedOlevel = dedupeRowsBySubjectName(normalizedOlevel);
        const dedupedAlevel = dedupeRowsBySubjectName(normalizedAlevel);

        // If the user entered the same subject in both sections (e.g., Chemistry in O-level and A-level),
        // treat it as a single subject and let A-level override O-level.
        const alevelNames = new Set(dedupedAlevel.map((r) => normalizeSubjectName(r.name)));
        const olevelToMap = shouldMapAlevel ? dedupedOlevel.filter((r) => !alevelNames.has(normalizeSubjectName(r.name))) : dedupedOlevel;

        const olevelList = shouldMapOlevel ? await mapRows("olevel", olevelToMap) : [];
        const alevelList = shouldMapAlevel ? await mapRows("alevel", dedupedAlevel) : [];

        if (cancelled) return;

        const olevelByKey = new Map<string, number>();
        for (const item of olevelList) {
          const nextLevel = normalizeMappedLevel(item.level);
          const capped = Math.min(OLEVEL_MAX_LEVEL, nextLevel);
          const key = normalizeSkillKey(item.skill_key);
          const prev = olevelByKey.get(key) ?? 0;
          if (capped > prev) olevelByKey.set(key, capped);
        }

        const alevelByKey = new Map<string, number>();
        for (const item of alevelList) {
          const nextLevel = normalizeMappedLevel(item.level);
          const key = normalizeSkillKey(item.skill_key);
          const prev = alevelByKey.get(key) ?? 0;
          if (nextLevel > prev) alevelByKey.set(key, nextLevel);
        }

        // Merge rule:
        // 1) Start with O-level baseline
        // 2) If A-level overlaps, overwrite with A-level (even if lower)
        const mergedByKey = new Map<string, number>(olevelByKey);
        for (const [skill_key, level] of alevelByKey.entries()) {
          mergedByKey.set(skill_key, level);
        }

        const merged = Array.from(mergedByKey.entries())
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
  }, [alevelComplete, needAlevelGrades, needOlevelGrades, needsAlevelSection, normalizedAlevel, normalizedOlevel, olevelComplete]);

  useEffect(() => {
    // Keep legacy fields updated for downstream logic (e.g., skill prefill / matching),
    // but do not ask them directly in the UI.
    const csTaken = deriveCsTaken([...normalizedOlevel, ...normalizedAlevel]);
    // Prefer A-level math if present; else O-level.
    const mathLevel = deriveMathLevel([...normalizedAlevel, ...normalizedOlevel], educationStage);
    setData("academics", {
      ...data.academics,
      subjects: [
        ...olevelRows.map((r) => ({ level: "olevel" as const, name: r.name, grade: r.grade })),
        ...alevelRows.map((r) => ({ level: "alevel" as const, name: r.name, grade: r.grade })),
      ],
      csTaken,
      mathLevel,
      mappedSkills,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [olevelRows, alevelRows, mappedSkills, setData]);

  const canNext =
    olevelComplete &&
    alevelComplete &&
    !subjectsLoading &&
    !subjectsError &&
    // If we're expecting grades, mapping should succeed before continuing.
    (!(needOlevelGrades || needAlevelGrades) || (!mappedSkillsLoading && !mappedSkillsError));

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Academics</h1>
      <Progress index={1} />
      <div className="rounded-2xl bg-white border shadow-sm p-5 space-y-4">
        {needsOlevelSection && (
          <div>
            <div className="text-sm font-medium mb-2">
              O-Level {needOlevelGrades ? "subjects & grades" : "subjects (in progress)"}
            </div>
            <div className="space-y-2">
              {olevelRows.map((row, idx) => (
                <div key={idx} className={`grid gap-2 ${needOlevelGrades ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
                  <select
                    className={`rounded-xl border bg-white px-3 py-2 ${needOlevelGrades ? "md:col-span-2" : ""}`}
                    value={row.name}
                    disabled={subjectsLoading || olevelOptions.length === 0}
                    onChange={(e) => {
                      const next = [...olevelRows];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setOlevelRows(next);
                    }}
                  >
                    <option value="">{subjectsLoading ? "Loading subjects..." : "Select subject"}</option>
                    {olevelOptions.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>

                  {needOlevelGrades && (
                    <select
                      className="rounded-xl border bg-white px-3 py-2"
                      value={row.grade}
                      onChange={(e) => {
                        const next = [...olevelRows];
                        next[idx] = { ...next[idx], grade: e.target.value };
                        setOlevelRows(next);
                      }}
                    >
                      <option value="">Select grade</option>
                      {GRADE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-xl border"
                onClick={() => setOlevelRows([...olevelRows, { name: "", grade: "" }])}
                disabled={subjectsLoading || olevelOptions.length === 0}
              >
                + Add subject
              </button>
              {olevelRows.length > 0 && (
                <button type="button" className="px-3 py-2 rounded-xl border" onClick={() => setOlevelRows(olevelRows.slice(0, -1))}>
                  − Remove last
                </button>
              )}
            </div>
          </div>
        )}

        {needsAlevelSection && (
          <div>
            <div className="text-sm font-medium mb-2">
              A-Level {needAlevelGrades ? "subjects & grades" : "subjects (in progress)"}
            </div>
            <div className="space-y-2">
              {alevelRows.map((row, idx) => (
                <div key={idx} className={`grid gap-2 ${needAlevelGrades ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
                  <select
                    className={`rounded-xl border bg-white px-3 py-2 ${needAlevelGrades ? "md:col-span-2" : ""}`}
                    value={row.name}
                    disabled={subjectsLoading || alevelOptions.length === 0}
                    onChange={(e) => {
                      const next = [...alevelRows];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setAlevelRows(next);
                    }}
                  >
                    <option value="">{subjectsLoading ? "Loading subjects..." : "Select subject"}</option>
                    {alevelOptions.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>

                  {needAlevelGrades && (
                    <select
                      className="rounded-xl border bg-white px-3 py-2"
                      value={row.grade}
                      onChange={(e) => {
                        const next = [...alevelRows];
                        next[idx] = { ...next[idx], grade: e.target.value };
                        setAlevelRows(next);
                      }}
                    >
                      <option value="">Select grade</option>
                      {GRADE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-xl border"
                onClick={() => setAlevelRows([...alevelRows, { name: "", grade: "" }])}
                disabled={subjectsLoading || alevelOptions.length === 0}
              >
                + Add subject
              </button>
              {alevelRows.length > 0 && (
                <button type="button" className="px-3 py-2 rounded-xl border" onClick={() => setAlevelRows(alevelRows.slice(0, -1))}>
                  − Remove last
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="mt-2 text-xs text-slate-500">Education stage: {educationStage ?? "—"}</p>
          {subjectsError && <p className="mt-2 text-xs text-red-600">Failed to load subjects: {subjectsError}</p>}
          {(needOlevelGrades || needAlevelGrades) && mappedSkillsLoading && (
            <p className="mt-2 text-xs text-slate-500">Calculating mapped skills…</p>
          )}
          {(needOlevelGrades || needAlevelGrades) && mappedSkillsError && (
            <p className="mt-2 text-xs text-red-600">Failed to map subjects to skills: {mappedSkillsError}</p>
          )}
        </div>
      </div>
      <StepNav prev="/onboarding/steps/basic" next="/onboarding/steps/about" canNext={canNext} />
    </div>
  );
}
