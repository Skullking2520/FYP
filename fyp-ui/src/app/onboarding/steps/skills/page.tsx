"use client";

import { useEffect, useRef, useState } from "react";
import { SkillPicker, type SelectedSkill } from "@/components/skill-picker";
import { Progress } from "../../_components/Progress";
import { StepNav } from "../../_components/StepNav";
import { useOnboarding } from "../../_components/OnboardingProvider";
import { formatSkillLabel, loadSelectedSkillsFromStorage, saveSelectedSkillsToStorage } from "@/lib/skills-storage";
import { getSkillDetail, searchSkills } from "@/lib/backend-api";

const ONBOARDING_DONE_KEY = "onboarding_completed_v1";

function buildPrefillQueries(params: {
  mathLevel: "low" | "mid" | "high" | null;
  csTaken: boolean;
  subjects: { name: string; grade: string }[];
}): string[] {
  const queries: string[] = [];
  const mathLevel = params.mathLevel;
  const csTaken = params.csTaken;

  if (csTaken) queries.push("programming", "software development", "algorithms");
  if (mathLevel === "high") queries.push("statistics", "linear algebra", "calculus");
  if (mathLevel === "mid") queries.push("statistics");

  for (const row of params.subjects) {
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    if (name) queries.push(name);
  }

  // unique + limit
  return Array.from(new Set(queries.map((q) => q.toLowerCase()))).slice(0, 6);
}

export default function SkillsStep() {
  const { data } = useOnboarding();
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>(() => loadSelectedSkillsFromStorage());
  const userEditedSkillsRef = useRef(false);

  useEffect(() => {
    if (userEditedSkillsRef.current) return;
    const extracted = Array.isArray(data.about.extractedSkills) ? data.about.extractedSkills : [];
    if (extracted.length === 0) return;

    const queries = extracted
      .map((s) => (typeof (s as any)?.skill_name === "string" ? String((s as any).skill_name).trim() : ""))
      .filter((x) => x.length > 0)
      .slice(0, 10);
    if (queries.length === 0) return;

    let cancelled = false;
    Promise.all(
      queries.map(async (q) => {
        const results = await searchSkills(q);
        const exact = results.find((s) => s.name.toLowerCase() === q.toLowerCase());
        return exact ?? results[0] ?? null;
      }),
    )
      .then((hits) => {
        if (cancelled || userEditedSkillsRef.current) return;
        setSelectedSkills((prev) => {
          const byKey = new Map<string, SelectedSkill>();
          for (const s of prev) byKey.set(s.skill_key, s);

          for (const hit of hits) {
            if (!hit) continue;
            if (!hit.skill_key || !String(hit.skill_key).trim()) continue;
            if (byKey.has(hit.skill_key)) continue;
            const name =
              typeof hit.name === "string" && hit.name.trim()
                ? hit.name.trim()
                : formatSkillLabel("", hit.skill_key) || "Unknown skill";
            byKey.set(hit.skill_key, { skill_key: hit.skill_key, name, level: 1 });
          }

          return Array.from(byKey.values());
        });
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, [data.about.extractedSkills]);

  useEffect(() => {
    saveSelectedSkillsToStorage(selectedSkills);
  }, [selectedSkills]);

  useEffect(() => {
    if (userEditedSkillsRef.current) return;
    if (selectedSkills.length > 0) return;

    let cancelled = false;

    const mapped = Array.isArray(data.academics.mappedSkills) ? data.academics.mappedSkills : [];
    const extracted = Array.isArray(data.about.extractedSkills) ? data.about.extractedSkills : [];

    const extractedQueries = extracted
      .map((s) => (typeof (s as any)?.skill_name === "string" ? String((s as any).skill_name).trim() : ""))
      .filter((x) => x.length > 0)
      .slice(0, 12);

    const normalizedMapped = mapped
      .filter((v): v is { skill_key: string; level: number } =>
        !!v && typeof (v as any).skill_key === "string" && typeof (v as any).level === "number",
      )
      .map((v) => ({ skill_key: String((v as any).skill_key), level: Math.max(0, Math.min(5, Math.round(Number((v as any).level)))) }));

    const byKey = new Map<string, number>();
    for (const item of normalizedMapped) {
      const prev = byKey.get(item.skill_key) ?? 0;
      if (item.level > prev) byKey.set(item.skill_key, item.level);
    }

    const topMapped = Array.from(byKey.entries())
      .map(([skill_key, level]) => ({ skill_key, level }))
      .sort((a, b) => b.level - a.level)
      .slice(0, 20);

    const fallbackQueries = buildPrefillQueries({
      mathLevel: data.academics.mathLevel,
      csTaken: data.academics.csTaken,
      subjects: data.academics.subjects,
    });

    const useFallback = topMapped.length === 0 && extractedQueries.length === 0;
    const nameQueries = useFallback ? fallbackQueries : extractedQueries;

    Promise.all([
      ...topMapped.map(async ({ skill_key, level }) => {
        try {
          const q = skill_key.replace(/[_-]+/g, " ");
          const results = await searchSkills(q);
          const exact = results.find((s) => s.skill_key === skill_key);
          const byName = results.find((s) => s.name.toLowerCase() === q.toLowerCase());
          const hit = exact ?? byName ?? null;
          if (hit?.name && hit.name.trim()) {
            return { skill_key, name: hit.name.trim(), level } satisfies SelectedSkill;
          }

          // Fallback: some skill_key values are ESCO URIs or codes; try detail.
          const detail = await getSkillDetail(skill_key);
          const detailName = typeof detail?.name === "string" ? detail.name.trim() : "";
          const name = detailName || formatSkillLabel("", skill_key) || "Unknown skill";
          return { skill_key, name, level } satisfies SelectedSkill;
        } catch {
          const name = formatSkillLabel("", skill_key) || "Unknown skill";
          return { skill_key, name, level } satisfies SelectedSkill;
        }
      }),
      ...nameQueries.map(async (q) => {
        try {
          const results = await searchSkills(q);
          const exact = results.find((s) => s.name.toLowerCase() === q.toLowerCase());
          const hit = exact ?? results[0] ?? null;
          if (!hit) return null;
          if (!hit.skill_key || !String(hit.skill_key).trim()) return null;
          return { skill_key: hit.skill_key, name: hit.name, level: 1 } satisfies SelectedSkill;
        } catch {
          return null;
        }
      }),
    ])
      .then((items) => {
        if (cancelled) return;
        const nextByKey = new Map<string, SelectedSkill>();
        for (const item of items) {
          if (!item) continue;
          if (!item.skill_key || !item.skill_key.trim()) continue;
          const prev = nextByKey.get(item.skill_key);
          if (!prev || item.level > prev.level) nextByKey.set(item.skill_key, item);
        }
        const next = Array.from(nextByKey.values());
        if (next.length > 0) setSelectedSkills(next);
      })
      .catch(() => {
        // ignore prefill failures
      });

    return () => {
      cancelled = true;
    };
  }, [data, selectedSkills.length]);

  const canNext = selectedSkills.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Select your skills</h1>
      <Progress index={3} />

      <div className="rounded-2xl bg-white border shadow-sm p-5 space-y-4">
        <p className="text-sm text-slate-600">
          Search skills, add them, and set your level. Selected skills are shown as bubbles below.
        </p>

        <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-medium text-slate-900 mb-2">What does the level mean?</div>
          <div className="grid gap-1 md:grid-cols-2">
            <div>
              <span className="font-semibold">0</span>: Not familiar
            </div>
            <div>
              <span className="font-semibold">1</span>: Basic awareness (can follow tutorials)
            </div>
            <div>
              <span className="font-semibold">2</span>: Beginner (have tried small tasks/projects)
            </div>
            <div>
              <span className="font-semibold">3</span>: Intermediate (can work independently)
            </div>
            <div>
              <span className="font-semibold">4</span>: Advanced (can solve complex problems)
            </div>
            <div>
              <span className="font-semibold">5</span>: Expert (can mentor/teach others)
            </div>
          </div>
        </div>

        <SkillPicker
          value={selectedSkills}
          onChange={(next) => {
            userEditedSkillsRef.current = true;
            setSelectedSkills(next);
          }}
        />
      </div>

      <StepNav
        prev="/onboarding/steps/about"
        next="/pathway/jobs"
        nextLabel="Finish"
        canNext={canNext}
        onNext={() => {
          try {
            localStorage.setItem(ONBOARDING_DONE_KEY, "1");
          } catch {
            // ignore
          }
        }}
      />
    </div>
  );
}
