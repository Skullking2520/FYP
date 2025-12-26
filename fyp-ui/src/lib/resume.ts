import { loadSelectedSkillsFromStorage } from "@/lib/skills-storage";
import { loadSelectedJob, loadSelectedMajor } from "@/lib/pathway-storage";

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
};

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
  return fullName.length > 1 && typeof stage === "string" && stage.length > 0;
}

function isAcademicsComplete(data: StoredOnboardingData | null): boolean {
  const subjects = data?.academics?.subjects;
  if (!Array.isArray(subjects) || subjects.length === 0) return false;
  return subjects.every((row) => {
    if (!row || typeof row !== "object") return false;
    const name = (row as any).name;
    const grade = (row as any).grade;
    return typeof name === "string" && name.trim().length > 0 && typeof grade === "string" && grade.trim().length > 0;
  });
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
  // Dashboard = onboarding wizard (name -> skills)
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
