import { formatSkillLabel, loadSelectedSkillsFromStorage } from "@/lib/skills-storage";
import { loadSelectedJob, loadSelectedMajor } from "@/lib/pathway-storage";
import type { ProfileUpdatePayload } from "@/lib/api";

export const LAST_PATH_KEY = "careerpath_last_path_v1";
export const ONBOARDING_DATA_KEY = "onboardingData";
export const ONBOARDING_DONE_KEY = "onboarding_completed_v1";
export const ONBOARDING_LAST_STEP_KEY = "onboarding_last_step_v1";

function isProbablyPath(value: string): boolean {
  return value.startsWith("/") && !value.includes("://") && !value.startsWith("/api");
}

export function shouldRememberPath(pathname: string): boolean {
  if (!isProbablyPath(pathname)) return false;
  if (pathname === "/") return false;
  if (pathname === "/login" || pathname === "/register") return false;
  return true;
}

export function rememberLastPath(pathname: string): void {
  if (typeof window === "undefined") return;
  if (!shouldRememberPath(pathname)) return;
  try {
    window.localStorage.setItem(LAST_PATH_KEY, pathname);
  } catch {
    // ignore
  }
}

export function getRememberedPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_PATH_KEY);
    if (!raw) return null;
    if (!shouldRememberPath(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

function getStoredOnboardingLastStep(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_LAST_STEP_KEY);
    if (!raw) return null;
    if (!raw.startsWith("/onboarding/steps/")) return null;
    return raw;
  } catch {
    return null;
  }
}

type StoredOnboardingData = {
  basic?: { fullName?: unknown; educationStage?: unknown };
  academics?: { subjects?: unknown };
  about?: { hobbies?: unknown; selfIntro?: unknown; extractedSkills?: unknown };
  career?: { notes?: unknown; targetJobs?: unknown };
};

function joinNonEmpty(parts: string[], sep: string): string {
  return parts.map((p) => p.trim()).filter((p) => p.length > 0).join(sep);
}

export function buildLocalProfileUpdatePayload(): ProfileUpdatePayload {
  // Best-effort: derive a "profile" payload from local onboarding + selected skills.
  // Used to mark Profiles completed once the user finishes pathway selections.
  const data = loadOnboardingDataFromStorage();

  const fullName =
    data?.basic && typeof data.basic.fullName === "string" ? data.basic.fullName.trim() : "";

  const hobbies = data?.about && typeof data.about.hobbies === "string" ? data.about.hobbies.trim() : "";
  const selfIntro = data?.about && typeof data.about.selfIntro === "string" ? data.about.selfIntro.trim() : "";
  const notes = data?.career && typeof data.career.notes === "string" ? data.career.notes.trim() : "";

  const interests_text = joinNonEmpty(
    [
      hobbies ? `Hobbies: ${hobbies}` : "",
      selfIntro ? `Self-introduction: ${selfIntro}` : "",
      notes ? `Notes: ${notes}` : "",
    ],
    "\n\n",
  );

  const selectedSkills = loadSelectedSkillsFromStorage();
  const skills_text = joinNonEmpty(
    selectedSkills.slice(0, 40).map((s) => {
      const key = typeof s?.skill_key === "string" ? s.skill_key : "";
      const name = typeof s?.name === "string" ? s.name : "";
      const label = formatSkillLabel(name, key) || name || key;
      const level = typeof s?.level === "number" && Number.isFinite(s.level) ? s.level : null;
      return label ? (level != null ? `${label} (Lv ${level})` : label) : "";
    }),
    ", ",
  );

  const payload: ProfileUpdatePayload = {};
  if (fullName) payload.name = fullName;
  if (interests_text) payload.interests_text = interests_text;
  if (skills_text) payload.skills_text = skills_text;
  return payload;
}

function loadOnboardingDataFromStorage(): StoredOnboardingData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as StoredOnboardingData;
  } catch {
    return null;
  }
}

function isBasicComplete(data: StoredOnboardingData | null): boolean {
  const fullName = data?.basic && typeof data.basic.fullName === "string" ? data.basic.fullName.trim() : "";
  const stage = data?.basic ? data.basic.educationStage : null;
  return fullName.length > 0 && typeof stage === "string" && stage.length > 0;
}

function isAcademicsComplete(data: StoredOnboardingData | null): boolean {
  const stageRaw = data?.basic?.educationStage;
  const stage = typeof stageRaw === "string" ? stageRaw : null;

  const subjectsRaw = data?.academics?.subjects;
  if (!Array.isArray(subjectsRaw) || subjectsRaw.length === 0) return false;

  const parsed = subjectsRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const level = record.level;
      const name = record.name;
      const grade = record.grade;
      return {
        level: level === "olevel" || level === "alevel" ? level : null,
        name: typeof name === "string" ? name.trim() : "",
        grade: typeof grade === "string" ? grade.trim() : "",
      };
    })
    .filter((v): v is { level: "olevel" | "alevel" | null; name: string; grade: string } => !!v)
    .filter((v) => v.name.length > 0 || v.grade.length > 0);

  if (parsed.length === 0) return false;

  const hasExplicitLevel = parsed.some((r) => r.level === "olevel" || r.level === "alevel");
  const inferredLevel: "olevel" | "alevel" = stage?.startsWith("alevel") ? "alevel" : "olevel";
  const withLevel = parsed.map((r) => ({ ...r, level: (r.level ?? inferredLevel) as "olevel" | "alevel" }));

  const olevel = withLevel.filter((r) => r.level === "olevel");
  const alevel = withLevel.filter((r) => r.level === "alevel");

  const anyOlevel = olevel.length > 0;
  const anyAlevel = alevel.length > 0;

  const allOlevelNames = olevel.every((r) => r.name.length > 0);
  const allOlevelGrades = olevel.every((r) => r.name.length > 0 && r.grade.length > 0);
  const allAlevelNames = alevel.every((r) => r.name.length > 0);
  const allAlevelGrades = alevel.every((r) => r.name.length > 0 && r.grade.length > 0);

  // Stage-specific rules:
  // - O-level in progress: pick O-level subjects only (no grades required)
  // - O-level done: O-level subjects + grades
  // - A-level in progress: O-level grades + A-level subjects (no A-level grades yet)
  // - A-level done: O-level grades + A-level grades
  if (stage === "olevel_in_progress") {
    return anyOlevel && allOlevelNames;
  }
  if (stage === "olevel_done") {
    return anyOlevel && allOlevelGrades;
  }
  if (stage === "alevel_in_progress") {
    return anyOlevel && allOlevelGrades && anyAlevel && allAlevelNames;
  }
  if (stage === "alevel_done") {
    return anyOlevel && allOlevelGrades && anyAlevel && allAlevelGrades;
  }

  // Unknown stage: fall back to strict (legacy behavior).
  if (!hasExplicitLevel) {
    return withLevel.every((r) => r.name.length > 0 && r.grade.length > 0);
  }
  return false;
}

export function getOnboardingResumePath(): string {
  const data = loadOnboardingDataFromStorage();

  // Prefer the explicit last-step marker if available.
  const lastStep = getStoredOnboardingLastStep();
  if (lastStep) return lastStep;

  if (!isBasicComplete(data)) return "/onboarding/steps/basic";
  if (!isAcademicsComplete(data)) return "/onboarding/steps/academics";

  // About step is the next step after Academics in our flow.
  // If the user already has selected skills, it's still safe to continue to About
  // (they can just click Next), but we prefer keeping the intended order.
  const skills = loadSelectedSkillsFromStorage();
  if (skills.length === 0) return "/onboarding/steps/about";

  return "/onboarding/steps/skills";
}

export function getDashboardEntryPath(): string {
  // Onboarding = onboarding wizard (name -> skills)
  return getOnboardingResumePath();
}

export function getPathwayResumePath(): string {
  const job = loadSelectedJob();
  const major = loadSelectedMajor();
  if (!job) return "/pathway/jobs";
  if (!major) return "/pathway/majors";
  return "/pathway/plan";
}

export function getRecommendationEntryPath(): string {
  if (typeof window === "undefined") return "/pathway/jobs";
  const done = window.localStorage.getItem(ONBOARDING_DONE_KEY);
  if (!done) return getOnboardingResumePath();
  return getPathwayResumePath();
}

export function getPostAuthRedirectPath(): string {
  if (typeof window === "undefined") return "/dashboard";

  const done = window.localStorage.getItem(ONBOARDING_DONE_KEY);

  if (!done) {
    return getOnboardingResumePath();
  }

  return getPathwayResumePath();
}
