"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BackendSkill } from "@/types/api";
import { BackendRequestError, getSkillDetail, searchSkills } from "@/lib/backend-api";
import { lookupSkillMetaByName } from "@/data/skill-meta";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSkillLabel, parseSelectedSkills, quantizeSkillLevel, SELECTED_SKILLS_STORAGE_KEY, SKILL_LEVEL_MAX, SKILL_LEVEL_STEP } from "@/lib/skills-storage";

export type SelectedSkill = {
  skill_key: string;
  name: string;
  level: number; // 0-10 (supports decimals)
};

function getSkillDescription(skill: BackendSkill): string | null {
  const anySkill = skill as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    skill.description,
    skill.definition,
    anySkill["skill_description"],
    anySkill["skillDefinition"],
    anySkill["description_text"],
    anySkill["scope_note"],
    anySkill["scopeNote"],
    anySkill["definition_text"],
  ];

  const cleanText = (text: string): string => {
    // Backend sometimes returns HTML-ish strings; keep UI as plain text.
    const noTags = text.replace(/<[^>]*>/g, " ");
    return noTags.replace(/\s+/g, " ").trim();
  };

  const coerceToText = (value: unknown): string | null => {
    if (typeof value === "string") {
      const cleaned = cleanText(value);
      return cleaned ? cleaned : null;
    }

    if (Array.isArray(value)) {
      const parts = value
        .map((v) => (typeof v === "string" ? cleanText(v) : ""))
        .map((v) => v.trim())
        .filter(Boolean);
      if (parts.length === 0) return null;
      const joined = cleanText(parts.join(" "));
      return joined ? joined : null;
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const nestedCandidates: unknown[] = [
        record.text,
        record.value,
        record.en,
        record.description,
        record.definition,
      ];
      for (const nested of nestedCandidates) {
        const maybe = coerceToText(nested);
        if (maybe) return maybe;
      }
    }

    return null;
  };

  for (const c of candidates) {
    const maybe = coerceToText(c);
    if (maybe) return maybe;
  }

  return null;
}

function getSkillCategoryLabel(skill: BackendSkill): string {
  const anySkill = skill as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    anySkill["category"],
    anySkill["skill_category"],
    anySkill["skillCategory"],
    anySkill["category_name"],
    anySkill["skillType"],
    anySkill["skill_type"],
    skill.dimension,
  ];

  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const cleaned = c.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }

  // Fallback: UI-only mapping so Category filter doesn't collapse to only "All"
  // when backend omits category fields.
  const displayName = formatSkillLabel(skill.name, skill.skill_key) || "Unknown skill";
  return lookupSkillMetaByName(displayName).category;
}

function getWordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 0);
}

function formatLevel(level: number): string {
  return Number.isInteger(level) ? String(level) : level.toFixed(1);
}

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
  const [detailByKey, setDetailByKey] = useState<Record<string, Partial<BackendSkill>>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attemptedDetailKeysRef = useRef<Set<string>>(new Set());
  const detailFetchDisabledRef = useRef(false);

  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");

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

  const mergedResults = useMemo(() => {
    if (!results || results.length === 0) return [];
    return results.map((skill) => {
      const patch = detailByKey[skill.skill_key];
      return patch ? ({ ...skill, ...patch } as BackendSkill) : skill;
    });
  }, [results, detailByKey]);

  const enrichedResults = useMemo(() => {
    return mergedResults.map((skill) => ({
      skill,
      category: getSkillCategoryLabel(skill),
    }));
  }, [mergedResults]);

  useEffect(() => {
    // Lazy-load richer skill detail (category/dimension/description) for a small
    // batch so filtering and description can use backend truth when available.
    if (!mergedResults || mergedResults.length === 0) return;
    if (detailFetchDisabledRef.current) return;

    const needsDetail = mergedResults
      .slice(0, 10)
      .filter((s) => {
        const anySkill = s as unknown as Record<string, unknown>;
        const category = anySkill["category"] ?? anySkill["skill_category"] ?? anySkill["category_name"] ?? anySkill["skillType"] ?? s.dimension;
        const description = anySkill["description"] ?? anySkill["definition"] ?? anySkill["scope_note"] ?? anySkill["description_text"];
        return !category || !description;
      })
      .map((s) => s.skill_key)
      .filter((k) => typeof k === "string" && k.length > 0);

    const missing = needsDetail.filter((k) => !attemptedDetailKeysRef.current.has(k));
    if (missing.length === 0) return;

    let cancelled = false;

    // Mark as attempted up-front so we don't spam the backend on repeated renders.
    for (const k of missing) attemptedDetailKeysRef.current.add(k);

    Promise.allSettled(missing.map((k) => getSkillDetail(k)))
      .then((settled) => {
        if (cancelled || !mountedRef.current) return;

        // If the backend doesn't expose the detail endpoint in this environment,
        // it will typically return 404. In that case, disable detail fetches for
        // this query to avoid spamming repeated 404s.
        const has404 = settled.some((r) => {
          if (r.status !== "rejected") return false;
          const reason = r.reason;
          return reason instanceof BackendRequestError && reason.status === 404;
        });
        if (has404) {
          detailFetchDisabledRef.current = true;
          return;
        }

        const updates: Record<string, Partial<BackendSkill>> = {};
        for (let i = 0; i < missing.length; i++) {
          const key = missing[i];
          const r = settled[i];
          if (r.status === "fulfilled" && r.value) {
            updates[key] = r.value;
          } else {
            // Cache a no-op entry to avoid refetching repeatedly when the backend returns 404.
            updates[key] = {};
          }
        }

        const keys = Object.keys(updates);
        if (keys.length === 0) return;
        setDetailByKey((prev) => ({ ...prev, ...updates }));
      })
      .catch(() => {
        // ignore detail failures; search should still work
      });

    return () => {
      cancelled = true;
    };
  }, [mergedResults]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const r of enrichedResults) set.add(r.category);
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [enrichedResults]);

  const filteredResults = useMemo(() => {
    const base = enrichedResults
      .filter(({ category }) => (categoryFilter === "all" ? true : category === categoryFilter))
      .map(({ skill }) => skill);

    const q = debouncedQuery.trim().toLowerCase();
    // Don't filter for truly empty input.
    if (q.length < 2) return base;

    // Only show results whose display name matches the query.
    const scored = base
      .map((skill) => {
        const label = formatSkillLabel(skill.name, skill.skill_key) || "";
        const name = label.toLowerCase();
        const tokens = getWordTokens(label);

        const starts = name.startsWith(q);
        const wordStart = tokens.some((t) => t.startsWith(q));
        const includes = name.includes(q);

        const score = starts ? 3 : wordStart ? 2 : includes ? 1 : 0;
        return { skill, score, wordStart };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    // Prefer word-start/prefix matches, but allow substring matches as a fallback.
    // (Requested UX: 2-char queries like "ch" should still return results.)
    const preferred = scored.filter((x) => x.score >= 2);
    if (q.length === 2) {
      if (preferred.length > 0) return preferred.map((x) => x.skill);
      return scored.map((x) => x.skill);
    }

    if (preferred.length > 0) return preferred.map((x) => x.skill);
    return scored.map((x) => x.skill);
  }, [enrichedResults, categoryFilter, debouncedQuery]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || q.length < 2) {
      setResults([]);
      setOpen(false);
      setError(null);
      setDetailByKey({});
      attemptedDetailKeysRef.current.clear();
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // New query: clear per-result detail caches and allow detail fetch again.
    setDetailByKey({});
    attemptedDetailKeysRef.current.clear();

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
    setSkills([...skills, { skill_key: skill.skill_key, name: skill.name, level: 0 }]);
    setQuery("");
    setResults([]);
    setDetailByKey({});
    attemptedDetailKeysRef.current.clear();
    setOpen(false);
    setError(null);
  };

  const removeSkill = (skill_key: string) => {
    setSkills(skills.filter((s) => s.skill_key !== skill_key));
  };

  const updateSkillLevel = (skill_key: string, level: number) => {
    const nextLevel = quantizeSkillLevel(level);
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
              className="ml-2 h-7 rounded-xl border bg-white px-2"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as string | "all")}
            >
              <option value="all">All</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
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
                  const displayName = formatSkillLabel(skill.name, skill.skill_key) || "Unknown skill";
                  const description = getSkillDescription(skill);
                  return (
                    <li key={`${skill.skill_key}-${skill.id}`}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                        onClick={() => addSkill(skill)}
                        disabled={disabled}
                      >
                        <div className="font-medium text-slate-900">{displayName}</div>
                        {description ? (
                          <div className="mt-1 line-clamp-2 text-xs text-slate-600">{description}</div>
                        ) : (
                          <div className="mt-1 text-xs text-slate-500">No description available</div>
                        )}
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
            <span>{formatSkillLabel(skill.name, skill.skill_key) || "Unknown skill"}</span>

            <span className="text-xs text-slate-600">Lv {formatLevel(skill.level)}</span>
            <input
              className="h-6 w-24"
              type="range"
              min={0}
              max={SKILL_LEVEL_MAX}
              step={SKILL_LEVEL_STEP}
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
