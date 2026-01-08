import type { SelectedSkill } from "@/components/skill-picker";

export const SELECTED_SKILLS_STORAGE_KEY = "selected_skills_v1";

export const SKILL_LEVEL_MAX = 10;
export const SKILL_LEVEL_STEP = 0.5;

export function normalizeSkillKey(value: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";

  // Normalize UUID-like keys so they match backend responses.
  // We have seen keys rendered/stored as space-separated groups: 8 4 4 4 12.
  const compact = raw.replace(/[\s-]+/g, "");
  const isCompactUuid = /^[0-9a-fA-F]{32}$/.test(compact);
  if (isCompactUuid) {
    const lower = compact.toLowerCase();
    return `${lower.slice(0, 8)}-${lower.slice(8, 12)}-${lower.slice(12, 16)}-${lower.slice(16, 20)}-${lower.slice(20)}`;
  }

  const hyphenated = raw.replace(/\s+/g, "-");
  if (looksLikeUuid(hyphenated)) return hyphenated.toLowerCase();

  return raw;
}

export function quantizeSkillLevel(level: number): number {
  const n = Number.isFinite(level) ? level : 0;
  const clamped = Math.max(0, Math.min(SKILL_LEVEL_MAX, n));
  return Math.round(clamped / SKILL_LEVEL_STEP) * SKILL_LEVEL_STEP;
}

export function coerceSkillLevel(level: unknown, fallback = 0): number {
  // Legacy string levels (0..5) are mapped into the new 0..10 scale.
  const legacyMapped = level === "advanced" ? 10 : level === "intermediate" ? 6 : level === "beginner" ? 2 : null;
  const numeric = typeof level === "number" ? level : legacyMapped ?? fallback;
  return quantizeSkillLevel(numeric);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function looksLikeUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v.startsWith("http://") || v.startsWith("https://");
}

export function looksLikeUuid(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;

  // Accept UUIDs that are:
  // - standard hyphenated
  // - 32 hex chars
  // - space-separated groups like: 8 4 4 4 12 (seen in UI)
  const v = raw.replace(/\s+/g, "-");
  const hyphenated = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const compact = /^[0-9a-fA-F]{32}$/;
  return hyphenated.test(v) || compact.test(raw);
}

export function formatSkillLabel(name: string | null | undefined, skill_key: string): string {
  const n = typeof name === "string" ? name.trim() : "";
  if (n && !looksLikeUrl(n) && !looksLikeUuid(n)) return n;

  const raw = (n || skill_key || "").trim();
  if (!raw) return "";

  if (looksLikeUrl(raw)) {
    try {
      const u = new URL(raw);
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts.length > 0 ? parts[parts.length - 1] : u.hostname;
      const decoded = safeDecodeURIComponent(last);
      return decoded.replace(/[_-]+/g, " ").trim() || decoded;
    } catch {
      // fall through
    }
  }

  const candidate = raw.includes("/") ? raw.split("/").filter(Boolean).pop() ?? raw : raw;
  const tail = candidate.includes(":") ? candidate.split(":").pop() ?? candidate : candidate;
  const decoded = safeDecodeURIComponent(tail);
  const cleaned = decoded.replace(/[_-]+/g, " ").trim() || decoded;
  // If we still ended up with a UUID-like token, treat it as not displayable.
  if (looksLikeUuid(cleaned)) return "";
  return cleaned;
}

export function parseSelectedSkills(raw: string | null): SelectedSkill[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.skill_key === "string" && typeof item.name === "string")
      .map((item) => {
        const levelRaw = (item as Record<string, unknown>).level;
        const skill_key = normalizeSkillKey(item.skill_key as string);
        return {
          skill_key,
          name: formatSkillLabel(item.name as string, skill_key),
          level: coerceSkillLevel(levelRaw, 0),
        } satisfies SelectedSkill;
      });
  } catch {
    return [];
  }
}

export function loadSelectedSkillsFromStorage(): SelectedSkill[] {
  if (typeof window === "undefined") return [];
  return parseSelectedSkills(localStorage.getItem(SELECTED_SKILLS_STORAGE_KEY));
}

export function saveSelectedSkillsToStorage(skills: SelectedSkill[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SELECTED_SKILLS_STORAGE_KEY, JSON.stringify(skills));
}

export function levelWeight(level: SelectedSkill["level"] | undefined): number {
  const numeric = typeof level === "number" ? level : 1;
  const q = quantizeSkillLevel(numeric);
  // Convert a 0..10 (step 0.5) value into a repeat count for the backend.
  // 0 -> 1, 0.5 -> 2, ... 10 -> 21
  const steps = Math.round(q / SKILL_LEVEL_STEP);
  return Math.max(1, steps + 1);
}

export function expandSkillKeysWithLevels(skills: SelectedSkill[]): string[] {
  return skills.flatMap((s) => {
    const key = normalizeSkillKey(s.skill_key);
    return Array.from({ length: levelWeight(s.level) }, () => key);
  });
}
