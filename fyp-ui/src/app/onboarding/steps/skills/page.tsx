"use client";

import { useEffect, useMemo, useState } from "react";
import { SkillPicker, type SelectedSkill } from "@/components/skill-picker";
import { Progress } from "../../_components/Progress";
import { StepNav } from "../../_components/StepNav";
import { useOnboarding } from "../../_components/OnboardingProvider";
import { useAuth } from "@/components/auth-provider";
import {
  coerceSkillLevel,
  formatSkillLabel,
  looksLikeUuid,
  loadSelectedSkillsFromStorage,
  normalizeSkillKey,
  saveSelectedSkillsToStorage,
} from "@/lib/skills-storage";
import { resolveSkills, resolveSkill, searchSkills } from "@/lib/backend-api";
import { updateStructuredProfile } from "@/lib/api";

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
  const { token } = useAuth();
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>(() => loadSelectedSkillsFromStorage());

  const structuredSkillsPayload = useMemo(() => {
    // Backend expects levels in a 0..5-ish scale (historically). Our UI uses 0..10.
    // To avoid backend validation errors, map to 0..5 in 0.5 steps.
    const toBackendLevel = (level: unknown): number => {
      const raw = typeof level === "number" && Number.isFinite(level) ? level : 0;
      const clamped = Math.max(0, Math.min(10, raw));
      // UI can be 0.5 steps in 0..10. Convert to 0..5 with 0.5 steps.
      const mapped = Math.round(clamped) / 2;
      return Math.max(0, Math.min(5, mapped));
    };

    const byKey = new Map<string, number>();
    for (const s of selectedSkills) {
      const key = normalizeSkillKey(s.skill_key);
      if (!key) continue;
      const nextLevel = toBackendLevel(s.level);
      const prev = byKey.get(key);
      if (prev === undefined || nextLevel > prev) byKey.set(key, nextLevel);
    }

    return Array.from(byKey.entries()).map(([skill_key, level]) => ({ skill_key, level }));
  }, [selectedSkills]);

  // Normalize keys and resolve missing/UUID-like labels using the backend.
  // This is important because some UUID keys can be persisted with spaces and
  // because prefill sources may provide keys without a reliable name.
  useEffect(() => {
    let cancelled = false;

    const needsResolve = selectedSkills.filter((s) => {
      const normalizedKey = normalizeSkillKey(s.skill_key);
      const label = formatSkillLabel(s.name, normalizedKey);
      return !label || looksLikeUuid(s.name) || looksLikeUuid(normalizedKey) || normalizedKey !== s.skill_key;
    });

    if (needsResolve.length === 0) return;

    const keys = Array.from(new Set(needsResolve.slice(0, 20).map((s) => normalizeSkillKey(s.skill_key)).filter((k) => k.length > 0)));

    resolveSkills(keys)
      .then((items) => {
        const updates = items
          .filter((i) => i && typeof i.skill_key === "string")
          .map((i) => (i.resolved && i.skill_name ? { skill_key: i.skill_key, name: i.skill_name } : null));

      if (cancelled) return;

      setSelectedSkills((prev) => {
        const byKey = new Map<string, SelectedSkill>();
        for (const s of prev) {
          const k = normalizeSkillKey(s.skill_key);
          const existing = byKey.get(k);
          if (!existing || s.level > existing.level) byKey.set(k, { ...s, skill_key: k });
        }

        let changed = false;

        // Apply normalized key updates + resolved names.
        for (const u of updates) {
          if (!u) continue;
          const prevSkill = byKey.get(u.skill_key);
          if (!prevSkill) continue;
          const prevLabel = formatSkillLabel(prevSkill.name, prevSkill.skill_key);
          const nextLabel = formatSkillLabel(u.name, prevSkill.skill_key);
          if (!nextLabel) continue;
          if (!prevLabel || prevLabel !== nextLabel || prevSkill.name !== u.name) {
            byKey.set(u.skill_key, { ...prevSkill, name: u.name });
            changed = true;
          }
        }

        const next = Array.from(byKey.values());
        if (!changed && next.length === prev.length) return prev;
        return next;
      });
      })
      .catch(() => {
        // ignore resolve failures
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSkills]);

  useEffect(() => {
    const extracted = Array.isArray(data.about.extractedSkills) ? data.about.extractedSkills : [];
    if (extracted.length === 0) return;

    const queries = extracted
      .map((s) => {
        if (!s || typeof s !== "object") return "";
        const name = (s as Record<string, unknown>).skill_name;
        return typeof name === "string" ? name.trim() : "";
      })
      .filter((x) => x.length > 0)
      .slice(0, 10);
    if (queries.length === 0) return;

    let cancelled = false;
    Promise.all(
      queries.map(async (rawQuery) => {
        const raw = rawQuery.trim();
        if (!raw) return null;

        const isUrl = /^https?:\/\//i.test(raw);
        const candidateKey = normalizeSkillKey(raw);

        // If the extractor produced a URI/UUID-like token, try resolving it as a key first.
        if ((isUrl || looksLikeUuid(raw)) && candidateKey) {
          try {
            const resolved = await resolveSkill(candidateKey);
            if (resolved?.resolved && typeof resolved.skill_name === "string" && resolved.skill_name.trim()) {
              return {
                skill_key: candidateKey,
                name: resolved.skill_name.trim(),
                level: 0,
              } satisfies SelectedSkill;
            }
          } catch {
            // fall through to search
          }
        }

        // Use a human-readable query (e.g. ESCO URI -> tail) when searching.
        const queryText = formatSkillLabel(raw, candidateKey) || raw;
        // Avoid searching for UUID-looking tokens; it tends to return garbage.
        if (looksLikeUuid(queryText)) return null;

        try {
          const results = await searchSkills(queryText);
          const exact = results.find((s) => s.name.toLowerCase() === queryText.toLowerCase());
          const hit = exact ?? results[0] ?? null;
          if (!hit) return null;

          const hitKey = normalizeSkillKey(hit.skill_key);
          const name = formatSkillLabel(hit.name ?? queryText, hitKey) || queryText;
          return { skill_key: hitKey, name, level: 0 } satisfies SelectedSkill;
        } catch {
          return null;
        }
      }),
    )
      .then((hits) => {
        if (cancelled) return;
        setSelectedSkills((prev) => {
          const byKey = new Map<string, SelectedSkill>();
          for (const s of prev) byKey.set(normalizeSkillKey(s.skill_key), { ...s, skill_key: normalizeSkillKey(s.skill_key) });

          for (const hit of hits) {
            if (!hit) continue;
            const hitKey = normalizeSkillKey(hit.skill_key);
            if (!hitKey) continue;
            if (byKey.has(hitKey)) continue;
            const safeName = typeof hit.name === "string" ? hit.name.trim() : "";
            byKey.set(hitKey, { skill_key: hitKey, name: safeName || formatSkillLabel(undefined, hitKey) || hitKey, level: 0 });
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
    let cancelled = false;

    const mapped = Array.isArray(data.academics.mappedSkills) ? data.academics.mappedSkills : [];
    const extracted = Array.isArray(data.about.extractedSkills) ? data.about.extractedSkills : [];

    const extractedHints = extracted
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const record = s as Record<string, unknown>;
        const rawName = typeof record.skill_name === "string" ? record.skill_name.trim() : "";
        const rawId = typeof record.skill_id === "string" ? record.skill_id.trim() : "";
        const keyHint = rawId || (rawName.startsWith("http://") || rawName.startsWith("https://") ? rawName : "");
        const query = rawName || rawId;
        if (!query) return null;
        return { query, keyHint: keyHint || null };
      })
      .filter((x): x is { query: string; keyHint: string | null } => !!x)
      .slice(0, 12);

    const normalizedMapped = mapped
      .filter((v): v is { skill_key: string; level: number } =>
        !!v &&
        typeof v === "object" &&
        typeof (v as Record<string, unknown>).skill_key === "string" &&
        typeof (v as Record<string, unknown>).level === "number",
      )
      .map((v) => {
        const record = v as Record<string, unknown>;
        const level = typeof record.level === "number" ? record.level : Number(record.level ?? 0);
        return {
          skill_key: normalizeSkillKey(String(record.skill_key ?? "")),
          level: coerceSkillLevel(level, 0),
        };
      })
      .filter((v) => v.skill_key.length > 0 && Number.isFinite(v.level));

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
      subjects: Array.isArray(data.academics.subjects)
        ? data.academics.subjects.map((r) => {
            if (!r || typeof r !== "object") return { name: "", grade: "" };
            const record = r as Record<string, unknown>;
            return {
              name: typeof record.name === "string" ? record.name : "",
              grade: typeof record.grade === "string" ? record.grade : "",
            };
          })
        : [],
    });

    const useFallback = topMapped.length === 0 && extractedHints.length === 0;
    const nameQueries: Array<{ query: string; keyHint: string | null }> = useFallback
      ? fallbackQueries.map((q) => ({ query: q, keyHint: null }))
      : extractedHints;

    Promise.all([
      ...topMapped.map(async ({ skill_key, level }) => {
        const normalizedKey = normalizeSkillKey(skill_key);
        try {
          const baseLabel = formatSkillLabel(undefined, normalizedKey);
          if (!baseLabel || looksLikeUuid(baseLabel)) {
            const resolved = await resolveSkill(normalizedKey);
            const name = resolved.resolved ? resolved.skill_name : null;
            return {
              skill_key: normalizedKey,
              name: formatSkillLabel(name ?? undefined, normalizedKey),
              level,
            } satisfies SelectedSkill;
          }

          const q = baseLabel.replace(/[_-]+/g, " ");
          const results = await searchSkills(q);
          const exact = results.find((s) => normalizeSkillKey(s.skill_key) === normalizedKey);
          const byName = results.find((s) => s.name.toLowerCase() === q.toLowerCase());
          const hit = exact ?? byName ?? null;
          return {
            skill_key: normalizedKey,
            name: formatSkillLabel(hit?.name, normalizedKey),
            level,
          } satisfies SelectedSkill;
        } catch {
          return {
            skill_key: normalizedKey,
            name: formatSkillLabel(undefined, normalizedKey),
            level,
          } satisfies SelectedSkill;
        }
      }),
      ...nameQueries.map(async ({ query, keyHint }) => {
        const raw = query.trim();
        if (!raw) return null;

        const hint = (keyHint ?? "").trim();
        const keyCandidate = normalizeSkillKey(hint || raw);
        const isUrl = /^https?:\/\//i.test(hint || raw);

        // Prefer resolving an ID/URI directly if we have one.
        if ((isUrl || looksLikeUuid(hint || raw)) && keyCandidate) {
          try {
            const resolved = await resolveSkill(keyCandidate);
            const name = typeof resolved?.skill_name === "string" ? resolved.skill_name.trim() : "";
            if (resolved?.resolved && name) {
              return { skill_key: keyCandidate, name, level: 0 } satisfies SelectedSkill;
            }
          } catch {
            // fall through
          }
        }

        const searchText = formatSkillLabel(raw, keyCandidate) || raw;
        // If we can't form a human-readable query, skip rather than adding "Unknown skill".
        if (!searchText || looksLikeUuid(searchText)) return null;

        try {
          const results = await searchSkills(searchText);
          const exact = results.find((s) => s.name.toLowerCase() === searchText.toLowerCase());
          const hit = exact ?? results[0] ?? null;
          if (!hit) return null;
          const hitKey = normalizeSkillKey(hit.skill_key);
          const name = formatSkillLabel(hit.name ?? searchText, hitKey) || searchText;
          if (!name) return null;
          return { skill_key: hitKey, name, level: 0 } satisfies SelectedSkill;
        } catch {
          return null;
        }
      }),
    ])
      .then((items) => {
        if (cancelled) return;
        const nextByKey = new Map<string, SelectedSkill>();

        // Start from existing selections and only ever raise levels.
        for (const s of selectedSkills) {
          const k = normalizeSkillKey(s.skill_key);
          const prev = nextByKey.get(k);
          if (!prev || s.level > prev.level) nextByKey.set(k, { ...s, skill_key: k });
        }

        for (const item of items) {
          if (!item) continue;
          const prev = nextByKey.get(item.skill_key);
          if (!prev || item.level > prev.level) nextByKey.set(item.skill_key, item);
        }
        const next = Array.from(nextByKey.values()).filter((s) => {
          const key = normalizeSkillKey(s.skill_key);
          const label = formatSkillLabel(s.name, key);
          const isPlaceholder = !label && (looksLikeUuid(s.name) || looksLikeUuid(key) || /^https?:\/\//i.test(key));
          // Only drop placeholders that are auto-prefilled (level 0).
          if (isPlaceholder && s.level <= 0) return false;
          return true;
        });

        const changed =
          next.length !== selectedSkills.length ||
          next.some((n) => {
            const prev = selectedSkills.find((s) => normalizeSkillKey(s.skill_key) === n.skill_key);
            if (!prev) return true;
            return prev.level !== n.level || prev.name !== n.name;
          });

        if (changed && next.length > 0) setSelectedSkills(next);
      })
      .catch(() => {
        // ignore prefill failures
      });

    return () => {
      cancelled = true;
    };
  }, [data, selectedSkills]);

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
              <span className="font-semibold">2</span>: Basic awareness (can follow tutorials)
            </div>
            <div>
              <span className="font-semibold">4</span>: Beginner (have tried small tasks/projects)
            </div>
            <div>
              <span className="font-semibold">6</span>: Intermediate (can work independently)
            </div>
            <div>
              <span className="font-semibold">8</span>: Advanced (can solve complex problems)
            </div>
            <div>
              <span className="font-semibold">10</span>: Expert (can mentor/teach others)
            </div>
            <div className="md:col-span-2 text-xs text-slate-600 mt-1">Tip: you can use half steps (e.g., 6.5) for finer control.</div>
          </div>
        </div>

        <SkillPicker value={selectedSkills} onChange={setSelectedSkills} />
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

          if (!token) return;
          if (structuredSkillsPayload.length === 0) return;
          void updateStructuredProfile(token, { skills: structuredSkillsPayload }, { keepalive: true }).catch((err) => {
            console.warn("Failed to persist structured skills", err);
          });
        }}
      />
    </div>
  );
}
