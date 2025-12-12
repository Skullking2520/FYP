import { PROGRAMS, getProgramById } from "@/data/programs";
import { getUniversityProgramsForProgram } from "@/data/universities";
import type {
  JobRecommendation,
  MajorRecommendation,
  RegisterPayload,
  SkillExtractionResponse,
  TokenResponse,
  UserProfile as RemoteUserProfile,
} from "@/types/api";
import type {
  Program,
  ProgramId,
  ProgramRecommendation,
  RecommendationOptions,
  UniversityId,
  UniversityProgram,
  UserProfile,
} from "@/types";
import { suggestJobsBySkills } from "./match";

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. Add it to your environment (see .env.example).",
    );
  }
  return baseUrl.replace(/\/$/, "");
}

async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.detail === "string") {
        message = errorBody.detail;
      }
    } catch (error) {
      console.error("Failed to parse error response", error);
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function loginRequest(email: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerRequest(payload: RegisterPayload): Promise<RemoteUserProfile> {
  return apiFetch<RemoteUserProfile>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProfile(token: string): Promise<RemoteUserProfile> {
  return apiFetch<RemoteUserProfile>("/users/me", { method: "GET" }, token);
}

export type ProfileUpdatePayload = {
  name?: string | null;
  age?: number | null;
  country?: string | null;
  interests_text?: string | null;
  skills_text?: string | null;
};

export async function updateProfile(token: string, payload: ProfileUpdatePayload): Promise<RemoteUserProfile> {
  return apiFetch<RemoteUserProfile>(
    "/users/me",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function extractSkills(user_text: string, token?: string | null): Promise<SkillExtractionResponse> {
  return apiFetch<SkillExtractionResponse>(
    "/recommend/nlp/extract-skills",
    {
      method: "POST",
      body: JSON.stringify({ user_text }),
    },
    token,
  );
}

export type RecommendationRequest = {
  limit?: number;
  skills?: string[];
  interests_text?: string;
  skills_text?: string;
};

export async function getJobRecommendations(
  token: string,
  payload: RecommendationRequest = {},
): Promise<JobRecommendation[]> {
  return apiFetch<JobRecommendation[]>(
    "/recommend/jobs",
    {
      method: "POST",
      body: JSON.stringify({ limit: 5, ...payload }),
    },
    token,
  );
}

export async function getMajorRecommendations(
  token: string,
  payload: RecommendationRequest = {},
): Promise<MajorRecommendation[]> {
  return apiFetch<MajorRecommendation[]>(
    "/recommend/majors",
    {
      method: "POST",
      body: JSON.stringify({ limit: 5, ...payload }),
    },
    token,
  );
}

function calculateProgramScore(program: Program, profile: UserProfile): number {
  const interestSet = new Set(profile.interests.map((interest) => interest.toLowerCase()));
  const focusMatches = program.focusAreas.filter((area) => interestSet.has(area.toLowerCase())).length;
  const tagMatches = program.tags.filter((tag) => interestSet.has(tag.toLowerCase())).length;
  let score = 0.25 + focusMatches * 0.2 + tagMatches * 0.1;
  if (profile.mathLevel === "high" && program.difficulty === "heavy") score += 0.25;
  if (profile.mathLevel === "mid" && program.difficulty !== "light") score += 0.15;
  if (profile.csTaken && program.tags.some((tag) => tag.toLowerCase().includes("program") || tag.toLowerCase().includes("algorithm"))) {
    score += 0.2;
  }
  if (profile.studyStyle && profile.studyStyle === program.studyStyle) score += 0.1;
  return Math.min(0.98, Number(score.toFixed(2)));
}

function buildReasonTags(program: Program, profile: UserProfile, jobReasons: string[]): string[] {
  const tags = new Set(jobReasons);
  program.focusAreas.forEach((area) => {
    if (profile.interests.some((interest) => interest.toLowerCase() === area.toLowerCase())) {
      tags.add(`Focus on ${area}`);
    }
  });
  if (profile.mathLevel === "high" && program.difficulty === "heavy") tags.add("Math-ready profile");
  if (profile.csTaken && program.tags.some((tag) => tag.toLowerCase().includes("algorithm"))) tags.add("CS fundamentals complete");
  if (profile.studyStyle && profile.studyStyle === program.studyStyle) tags.add(`${program.studyStyle} study match`);
  return Array.from(tags).slice(0, 4);
}

function matchesFilters(program: Program, options: RecommendationOptions): boolean {
  if (options.region && options.region !== "all" && !program.regions.includes(options.region)) return false;
  if (options.studyStyle && options.studyStyle !== "all" && program.studyStyle !== options.studyStyle) return false;
  if (options.difficulty && options.difficulty !== "all" && program.difficulty !== options.difficulty) return false;
  return true;
}

function sortRecommendations(data: ProgramRecommendation[], sort?: RecommendationOptions["sort"]): ProgramRecommendation[] {
  if (sort === "math-first") {
    return [...data].sort((a, b) => {
      const aMath = a.tags.some((tag) => tag.toLowerCase().includes("math")) ? 1 : 0;
      const bMath = b.tags.some((tag) => tag.toLowerCase().includes("math")) ? 1 : 0;
      if (aMath === bMath) return b.matchScore - a.matchScore;
      return bMath - aMath;
    });
  }
  if (sort === "study-style") {
    return [...data].sort((a, b) => a.studyStyle.localeCompare(b.studyStyle) || b.matchScore - a.matchScore);
  }
  return [...data].sort((a, b) => b.matchScore - a.matchScore);
}

export async function fetchRecommendedPrograms(
  profile: UserProfile,
  options: RecommendationOptions = {},
): Promise<ProgramRecommendation[]> {
  const jobReasons = suggestJobsBySkills(profile).flatMap((suggestion) => suggestion.reason);
  const filtered = PROGRAMS.filter((program) => matchesFilters(program, options));
  const enriched = filtered.map<ProgramRecommendation>((program) => ({
    ...program,
    matchScore: calculateProgramScore(program, profile),
    reasonTags: buildReasonTags(program, profile, jobReasons),
  }));
  return sortRecommendations(enriched, options.sort);
}

export async function fetchProgramDetail(id: ProgramId): Promise<Program | null> {
  return getProgramById(id) ?? null;
}

export async function fetchProgramUniversities(id: ProgramId): Promise<UniversityProgram[]> {
  return getUniversityProgramsForProgram(id);
}

export async function fetchUniversityProgram(
  programId: ProgramId,
  uniId: UniversityId,
): Promise<UniversityProgram | null> {
  return getUniversityProgramsForProgram(programId).find((uni) => uni.uniId === uniId) ?? null;
}
