"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BackendSkill } from "@/types/api";
import { searchSkills } from "@/lib/backend-api";
import { lookupSkillMetaByName, type SkillCategory, type SkillDifficulty } from "@/data/skill-meta";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseSelectedSkills, SELECTED_SKILLS_STORAGE_KEY } from "@/lib/skills-storage";

export type SelectedSkill = {
  skill_key: string;
  name: string;
  level: number; // 0-5
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}


type Props = {
  value?: SelectedSkill[];
  onChange?: (skills: SelectedSkill[]) => void;
};

export function SkillPicker({ value, onChange }: Props) {
  const [internalSkills, setInternalSkills] = useState<SelectedSkill[]>([]);
  const skills = value ?? internalSkills;

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const [results, setResults] = useState<BackendSkill[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<SkillDifficulty | "all">("all");

  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const saved = parseSelectedSkills(localStorage.getItem(SELECTED_SKILLS_STORAGE_KEY));
    if (saved.length > 0 && !value) {
      setInternalSkills(saved);
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value) return;
    localStorage.setItem(SELECTED_SKILLS_STORAGE_KEY, JSON.stringify(internalSkills));
  }, [internalSkills, value]);

  const setSkills = (next: SelectedSkill[]) => {
    if (onChange) onChange(next);
    if (!value) setInternalSkills(next);
  };

  const selectedKeys = useMemo(() => new Set(skills.map((s) => s.skill_key)), [skills]);

  const enrichedResults = useMemo(() => {
    return results.map((skill) => ({
      skill,
      meta: lookupSkillMetaByName(skill.name),
    }));
  }, [results]);

  const availableCategories = useMemo(() => {
    const set = new Set<SkillCategory>();
    for (const r of enrichedResults) set.add(r.meta.category);
    return Array.from(set).sort();
  }, [enrichedResults]);

  const availableDifficulties = useMemo(() => {
    const set = new Set<SkillDifficulty>();
    for (const r of enrichedResults) set.add(r.meta.difficulty);
    return Array.from(set);
  }, [enrichedResults]);

  const filteredResults = useMemo(() => {
    return enrichedResults
      .filter(({ meta }) => (categoryFilter === "all" ? true : meta.category === categoryFilter))
      .filter(({ meta }) => (difficultyFilter === "all" ? true : meta.difficulty === difficultyFilter))
      .map(({ skill }) => skill);
  }, [enrichedResults, categoryFilter, difficultyFilter]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchSkills(q)
      .then((data) => {
        if (cancelled || !mountedRef.current) return;
        setResults(data);
        setOpen(true);
      })
      .catch((err) => {
        if (cancelled || !mountedRef.current) return;
        const message = err instanceof Error ? err.message : "Failed to search skills";
        setError(message);
        setResults([]);
        setOpen(true);
      })
      .finally(() => {
        if (cancelled || !mountedRef.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const addSkill = (skill: BackendSkill) => {
    if (selectedKeys.has(skill.skill_key)) return;
    setSkills([...skills, { skill_key: skill.skill_key, name: skill.name, level: 1 }]);
    setQuery("");
    setResults([]);
    setOpen(false);
    setError(null);
  };

  const removeSkill = (skill_key: string) => {
    setSkills(skills.filter((s) => s.skill_key !== skill_key));
  };

  const updateSkillLevel = (skill_key: string, level: number) => {
    const nextLevel = Math.max(0, Math.min(5, Math.round(level)));
    setSkills(skills.map((s) => (s.skill_key === skill_key ? { ...s, level: nextLevel } : s)));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm text-slate-600">
          Search skills
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0 || error) setOpen(true);
            }}
            placeholder="Type a skill (e.g., python, data analysis)"
            aria-label="Skill search"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <label className="text-xs text-slate-600">
            Category
            <select
              className="ml-2 h-8 rounded-xl border bg-white px-2"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as SkillCategory | "all")}
            >
              <option value="all">All</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Difficulty
            <select
              className="ml-2 h-8 rounded-xl border bg-white px-2"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value as SkillDifficulty | "all")}
            >
              <option value="all">All</option>
              {availableDifficulties.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        {open && (loading || error || filteredResults.length > 0 || results.length === 0) && (
          <div className="rounded-xl border bg-white p-2 shadow-sm">
            {loading && <div className="px-2 py-2 text-sm text-slate-500">Searching…</div>}
            {!loading && error && <div className="px-2 py-2 text-sm text-red-600">{error}</div>}
            {!loading && !error && results.length === 0 && (
              <div className="px-2 py-2 text-sm text-slate-500">No results</div>
            )}
            {!loading && !error && results.length > 0 && filteredResults.length === 0 && (
              <div className="px-2 py-2 text-sm text-slate-500">No results (filtered)</div>
            )}
            {!loading && filteredResults.length > 0 && (
              <ul className="max-h-64 overflow-auto">
                {filteredResults.map((skill) => {
                  const disabled = selectedKeys.has(skill.skill_key);
                  const meta = lookupSkillMetaByName(skill.name);
                  return (
                    <li key={`${skill.skill_key}-${skill.id}`}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                        onClick={() => addSkill(skill)}
                        disabled={disabled}
                      >
                        <div className="font-medium text-slate-900">{skill.name}</div>
                        <div className="text-xs text-slate-500">
                          {(skill.source ?? "Unknown").toString()}
                          {skill.dimension ? ` • ${skill.dimension}` : ""}
                          {` • ${meta.category} • ${meta.difficulty}`}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {skills.length === 0 && <span className="text-sm text-slate-500">No skills selected yet.</span>}
        {skills.map((skill) => (
          <Badge key={skill.skill_key} variant="secondary" className="gap-2">
            <span>{skill.name}</span>

            <span className="text-xs text-slate-600">Lv {skill.level}</span>
            <input
              className="h-6 w-24"
              type="range"
              min={0}
              max={5}
              step={1}
              value={skill.level}
              onChange={(e) => updateSkillLevel(skill.skill_key, Number(e.target.value))}
              aria-label={`Set level for ${skill.name}`}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 rounded-full"
              onClick={() => removeSkill(skill.skill_key)}
              aria-label={`Remove ${skill.name}`}
            >
              ×
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
