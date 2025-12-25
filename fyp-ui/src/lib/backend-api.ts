import type {
  BackendJob,
  BackendJobRecommendation,
  BackendJobSkill,
  BackendMajorProgramRanking,
  BackendMajorRecommendation,
  BackendMajorSkill,
  BackendSkillResource,
  BackendSkill,
  MajorGapsRequest,
  RecommendJobsRequest,
  SkillExtractionResponse,
} from "@/types/api";

async function backendFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        message = body.detail;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

const skillSearchCache = new Map<string, BackendSkill[]>();

export async function searchSkills(q: string): Promise<BackendSkill[]> {
  const query = q.trim();
  if (!query) return [];

  const cached = skillSearchCache.get(query);
  if (cached) return cached;

  const params = new URLSearchParams({ q: query });
  const result = await backendFetch<BackendSkill[]>(`/api/skills/search?${params.toString()}`, {
    method: "GET",
  });

  skillSearchCache.set(query, result);
  return result;
}

export async function recommendJobs(skill_keys: string[]): Promise<BackendJobRecommendation[]> {
  const payload: RecommendJobsRequest = { skill_keys };
  return backendFetch<BackendJobRecommendation[]>("/api/recommend/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function extractSkillsFromText(user_text: string, token?: string | null): Promise<SkillExtractionResponse> {
  const text = user_text.trim();
  if (!text) return { skills: [] };
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Backend NLP extraction endpoint currently lives under /recommend/* (no /api prefix).
  // Use the legacy proxy to reach it: /api/legacy/<rest> -> upstream /<rest>
  return backendFetch<SkillExtractionResponse>("/api/legacy/recommend/nlp/extract-skills", {
    method: "POST",
    headers,
    body: JSON.stringify({ user_text: text }),
  });
}

export async function getJob(job_id: string): Promise<BackendJob> {
  return backendFetch<BackendJob>(`/api/jobs/${encodeURIComponent(job_id)}`, { method: "GET" });
}

export async function getJobSkills(job_id: string): Promise<BackendJobSkill[]> {
  return backendFetch<BackendJobSkill[]>(`/api/jobs/${encodeURIComponent(job_id)}/skills`, { method: "GET" });
}

export async function getJobMajors(job_id: string, top_k = 5): Promise<BackendMajorRecommendation[]> {
  const params = new URLSearchParams({ top_k: String(top_k) });
  return backendFetch<BackendMajorRecommendation[]>(
    `/api/jobs/${encodeURIComponent(job_id)}/majors?${params.toString()}`,
    { method: "GET" },
  );
}

export async function getMajorGaps(major_id: string, skill_keys: string[]): Promise<BackendMajorSkill[]> {
  const payload: MajorGapsRequest = { skill_keys: skill_keys.slice(0, 200) };
  return backendFetch<BackendMajorSkill[]>(`/api/majors/${encodeURIComponent(major_id)}/gaps`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMajorPrograms(major_id: string, top_k = 10): Promise<BackendMajorProgramRanking[]> {
  const params = new URLSearchParams({ top_k: String(top_k) });
  return backendFetch<BackendMajorProgramRanking[]>(
    `/api/majors/${encodeURIComponent(major_id)}/programs?${params.toString()}`,
    { method: "GET" },
  );
}

export async function getSkillResources(skill_key: string, top_k = 10): Promise<BackendSkillResource[]> {
  const params = new URLSearchParams({ top_k: String(top_k) });
  return backendFetch<BackendSkillResource[]>(
    `/api/skills/${encodeURIComponent(skill_key)}/resources?${params.toString()}`,
    { method: "GET" },
  );
}
