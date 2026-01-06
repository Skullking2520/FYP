import type { SelectedSkill } from "@/components/skill-picker";

export const SELECTED_SKILLS_STORAGE_KEY = "selected_skills_v1";

export function formatSkillLabel(name: unknown, skill_key: unknown): string {
  const rawName = typeof name === "string" ? name.trim() : "";
  if (rawName) return rawName;

  const rawKey = typeof skill_key === "string" ? skill_key.trim() : "";
  if (!rawKey) return "";

  try {
    const url = new URL(rawKey);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last ?? rawKey;
  } catch {
    const last = rawKey.split("/").filter(Boolean).pop();
    return last ?? rawKey;
  }
}

export function coerceSkillLevel(level: unknown, fallback = 1): number {
  const legacyMapped = level === "advanced" ? 5 : level === "intermediate" ? 3 : level === "beginner" ? 1 : null;
  const numeric = typeof level === "number" ? level : legacyMapped ?? fallback;
  return Math.max(0, Math.min(5, Math.round(numeric)));
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
        return {
          skill_key: item.skill_key as string,
          name: item.name as string,
          level: coerceSkillLevel(levelRaw, 1),
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
  const clamped = Math.max(0, Math.min(5, Math.round(numeric)));
  return clamped + 1;
}

export function expandSkillKeysWithLevels(skills: SelectedSkill[]): string[] {
  return skills.flatMap((s) => Array.from({ length: levelWeight(s.level) }, () => s.skill_key));
}
