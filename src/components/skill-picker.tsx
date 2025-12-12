"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BackendSkill } from "@/types/api";
import { searchSkills } from "@/lib/backend-api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type SelectedSkill = {
  skill_key: string;
  name: string;
};

const STORAGE_KEY = "selected_skills_v1";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

function safeParseSelectedSkills(raw: string | null): SelectedSkill[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.skill_key === "string" && typeof item.name === "string")
      .map((item) => ({ skill_key: item.skill_key, name: item.name })) as SelectedSkill[];
  } catch {
    return [];
  }
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

  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const saved = safeParseSelectedSkills(localStorage.getItem(STORAGE_KEY));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(internalSkills));
  }, [internalSkills, value]);

  const setSkills = (next: SelectedSkill[]) => {
    if (onChange) onChange(next);
    if (!value) setInternalSkills(next);
  };

  const selectedKeys = useMemo(() => new Set(skills.map((s) => s.skill_key)), [skills]);

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
    setSkills([...skills, { skill_key: skill.skill_key, name: skill.name }]);
    setQuery("");
    setResults([]);
    setOpen(false);
    setError(null);
  };

  const removeSkill = (skill_key: string) => {
    setSkills(skills.filter((s) => s.skill_key !== skill_key));
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

        {open && (loading || error || results.length > 0) && (
          <div className="rounded-xl border bg-white p-2 shadow-sm">
            {loading && <div className="px-2 py-2 text-sm text-slate-500">Searching…</div>}
            {!loading && error && <div className="px-2 py-2 text-sm text-red-600">{error}</div>}
            {!loading && !error && results.length === 0 && (
              <div className="px-2 py-2 text-sm text-slate-500">No results</div>
            )}
            {!loading && results.length > 0 && (
              <ul className="max-h-64 overflow-auto">
                {results.map((skill) => {
                  const disabled = selectedKeys.has(skill.skill_key);
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
