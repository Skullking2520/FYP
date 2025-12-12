import type { GapAnalysis, JobSuggestion, UserProfile } from "@/types";

type StoredInterests = {
  areas?: unknown;
  studyStyle?: "project" | "research" | "exam" | null;
};
type StoredAcademics = {
  mathLevel?: "low" | "mid" | "high" | null;
  csTaken?: unknown;
};
type StoredRoot = {
  interests?: StoredInterests;
  academics?: StoredAcademics;
};
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
function isStoredInterests(v: unknown): v is StoredInterests {
  if (!isRecord(v)) return false;

  const areas = v["areas"];
  const studyStyle = v["studyStyle"];

  if (areas !== undefined && !isStringArray(areas)) return false;
  if (
    studyStyle !== undefined &&
    studyStyle !== null &&
    studyStyle !== "project" &&
    studyStyle !== "research" &&
    studyStyle !== "exam"
  ) {
    return false;
  }
  return true;
}
function isStoredAcademics(v: unknown): v is StoredAcademics {
  if (!isRecord(v)) return false;

  const mathLevel = v["mathLevel"];
  const csTaken = v["csTaken"];

  if (
    mathLevel !== undefined &&
    mathLevel !== null &&
    mathLevel !== "low" &&
    mathLevel !== "mid" &&
    mathLevel !== "high"
  ) {
    return false;
  }
  if (csTaken !== undefined && typeof csTaken !== "boolean") {
    return false;
  }
  return true;
}
function isStoredRoot(v: unknown): v is StoredRoot {
  return isRecord(v);
}

export function buildUserProfile(raw: unknown): UserProfile {
  if (!isStoredRoot(raw)) {
    return { interests: [], mathLevel: null, csTaken: false };
  }

  const interestsObj = isStoredInterests(raw.interests) ? raw.interests : undefined;
  const academicsObj = isStoredAcademics(raw.academics) ? raw.academics : undefined;

  const areas = interestsObj?.areas;
  const interests: string[] = isStringArray(areas) ? areas : [];
  const mathLevel = academicsObj?.mathLevel ?? null;
  const studyStyle = interestsObj?.studyStyle ?? null;

  let csTaken = false;
  if (typeof academicsObj?.csTaken === "boolean") csTaken = academicsObj.csTaken as boolean;

  return { interests, mathLevel, csTaken, studyStyle };
}

export function suggestJobsBySkills(p: UserProfile): JobSuggestion[] {
  const S: JobSuggestion[] = [];
  const has = (k: string) => p.interests.includes(k);

  if (has("Data") || (p.mathLevel === "high" && has("AI"))) {
    S.push({ id: "data-scientist", title: "Data Scientist", reason: ["High math/AI interest", "Stat/ML fit"] });
  }
  if (has("AI") || p.csTaken) {
    S.push({ id: "ml-engineer", title: "ML Engineer", reason: ["AI interest", "CS background"] });
  }
  if (has("Software Engineering")) S.push({ id: "software-engineer", title: "Software Engineer", reason: ["SE interest"] });
  if (has("Cybersecurity")) S.push({ id: "security-analyst", title: "Security Analyst", reason: ["Cybersecurity interest"] });
  if (has("Game Dev")) S.push({ id: "game-developer", title: "Game Developer", reason: ["Game Dev interest"] });
  if (S.length === 0) S.push({ id: "it-analyst", title: "IT Analyst", reason: ["General IT fit"] });
  return S;
}

export function analyzeGaps(requiredSkills: string[], userSkills: string[]): GapAnalysis {
  const setUser = new Set(userSkills.map((s) => s.toLowerCase()));
  const missing = requiredSkills.filter((rs) => !setUser.has(rs.toLowerCase()));
  const covered = requiredSkills.filter((rs) => setUser.has(rs.toLowerCase()));
  return { missing, covered };
}

export function userSkillKeywords(p: UserProfile): string[] {
  const base = [...p.interests];
  if (p.csTaken) base.push("Programming", "Algorithms");
  if (p.mathLevel === "high") base.push("Calculus", "Statistics", "Linear Algebra");
  if (p.mathLevel === "mid") base.push("Statistics");
  return base;
}
