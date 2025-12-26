import type {
  BackendJob,
  BackendJobRecommendation,
  BackendJobSearchResult,
  BackendJobSkill,
  BackendMajorProgramRanking,
  BackendMajorRecommendation,
  BackendMajorSkill,
  BackendSkillResource,
  BackendSkill,
  MajorGapsRequest,
  RecommendJobsRequest,
  SkillExtractionResponse,
  BackendPathwaySummary,
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

async function backendFetchWithFallback<T>(paths: string[], init: RequestInit = {}): Promise<T> {
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      return await backendFetch<T>(path, init);
    } catch (err) {
      lastError = err;
    }
  }
  throw (lastError instanceof Error ? lastError : new Error("Request failed"));
}

function coerceArrayResponse<T>(value: unknown, candidateKeys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of candidateKeys) {
    const maybe = record[key];
    if (Array.isArray(maybe)) return maybe as T[];
  }
  return [];
}

const skillSearchCache = new Map<string, BackendSkill[]>();
const jobSearchCache = new Map<string, BackendJobSearchResult[]>();

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

export async function searchJobs(query: string, top_k = 20): Promise<BackendJobSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const safeTopK = Math.max(1, Math.min(50, Math.floor(top_k)));
  const cacheKey = `${q}::${safeTopK}`;
  const cached = jobSearchCache.get(cacheKey);
  if (cached) return cached;

  const paramsQ = new URLSearchParams({ q, top_k: String(safeTopK) });
  const paramsName = new URLSearchParams({ name: q, top_k: String(safeTopK) });

  const result = await backendFetchWithFallback<BackendJobSearchResult[]>(
    [
      `/api/jobs/search?${paramsQ.toString()}`,
      `/api/jobs/search?${paramsName.toString()}`,

      // Back-compat: FastAPI mounted under /api/* but accessed via legacy proxy
      `/api/legacy/api/jobs/search?${paramsQ.toString()}`,
      `/api/legacy/api/jobs/search?${paramsName.toString()}`,

      // Back-compat: routes without /api prefix (legacy proxy required)
      `/api/legacy/jobs/search?${paramsQ.toString()}`,
      `/api/legacy/jobs/search?${paramsName.toString()}`,
    ],
    { method: "GET" },
  );

  const normalized = Array.isArray(result) ? result : [];
  jobSearchCache.set(cacheKey, normalized);
  return normalized;
}


export async function extractSkillsFromText(user_text: string, token?: string | null): Promise<SkillExtractionResponse> {
  const text = user_text.trim();
  if (!text) return { skills: [] };
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Prefer the canonical /api prefix if backend provides it.
  return backendFetchWithFallback<SkillExtractionResponse>(
    [
      "/api/recommend/nlp/extract-skills",
      // Back-compat: extractor without /api prefix (legacy proxy required)
      "/api/legacy/recommend/nlp/extract-skills",
      "/api/legacy/api/recommend/nlp/extract-skills",
    ],
    {
      method: "POST",
      headers,
      body: JSON.stringify({ user_text: text }),
    },
  );
}

export async function getPathwaySummary(token: string): Promise<BackendPathwaySummary> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  return backendFetchWithFallback<BackendPathwaySummary>(
    [
      "/api/users/me/pathway-summary",
      "/api/legacy/users/me/pathway-summary",
      "/api/legacy/api/users/me/pathway-summary",
    ],
    { method: "GET", headers },
  );
}

export async function getJob(job_id: string): Promise<BackendJob> {
  const encoded = encodeURIComponent(job_id);
  return backendFetchWithFallback<BackendJob>(
    [
      `/api/jobs/${encoded}`,
      // Some deployments expose these routes without the /api prefix.
      `/api/legacy/jobs/${encoded}`,
      // Some deployments expose FastAPI under /api/* but via legacy proxy.
      `/api/legacy/api/jobs/${encoded}`,
    ],
    { method: "GET" },
  );
}

export async function getJobSkills(job_id: string): Promise<BackendJobSkill[]> {
  const encoded = encodeURIComponent(job_id);
  return backendFetchWithFallback<BackendJobSkill[]>(
    [
      `/api/jobs/${encoded}/skills`,
      `/api/legacy/jobs/${encoded}/skills`,
      `/api/legacy/api/jobs/${encoded}/skills`,
    ],
    { method: "GET" },
  );
}

export async function getJobMajors(job_id: string, top_k = 5): Promise<BackendMajorRecommendation[]> {
  const params = new URLSearchParams({ top_k: String(top_k) });
  const encoded = encodeURIComponent(job_id);
  return backendFetchWithFallback<BackendMajorRecommendation[]>(
    [
      `/api/jobs/${encoded}/majors?${params.toString()}`,
      `/api/legacy/jobs/${encoded}/majors?${params.toString()}`,
      `/api/legacy/api/jobs/${encoded}/majors?${params.toString()}`,
    ],
    { method: "GET" },
  );
}

export async function getMajorGaps(major_id: string, skill_keys: string[]): Promise<BackendMajorSkill[]> {
  const payload: MajorGapsRequest = { skill_keys: skill_keys.slice(0, 200) };
  const encoded = encodeURIComponent(major_id);
  const result = await backendFetchWithFallback<unknown>(
    [
      `/api/majors/${encoded}/gaps`,
      // Back-compat: routes without the /api prefix (legacy proxy required)
      `/api/legacy/majors/${encoded}/gaps`,
      // Back-compat: FastAPI mounted under /api/* but accessed via legacy proxy
      `/api/legacy/api/majors/${encoded}/gaps`,
    ],
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return coerceArrayResponse<BackendMajorSkill>(result, [
    "gaps",
    "missing_skills",
    "missingSkills",
    "skills",
    "items",
    "results",
    "data",
  ]);
}

export async function getMajorPrograms(major_id: string, top_k = 10): Promise<BackendMajorProgramRanking[]> {
  const params = new URLSearchParams({ top_k: String(top_k) });
  const encoded = encodeURIComponent(major_id);
  const result = await backendFetchWithFallback<unknown>(
    [
      `/api/majors/${encoded}/programs?${params.toString()}`,
      `/api/legacy/majors/${encoded}/programs?${params.toString()}`,
      `/api/legacy/api/majors/${encoded}/programs?${params.toString()}`,
    ],
    { method: "GET" },
  );

  return coerceArrayResponse<BackendMajorProgramRanking>(result, [
    "programs",
    "rankings",
    "items",
    "results",
    "data",
  ]);
}

export async function getSkillResources(skill_key: string, top_k = 10): Promise<BackendSkillResource[]> {
  const params = new URLSearchParams({ top_k: String(top_k) });
  const encoded = encodeURIComponent(skill_key);
  const result = await backendFetchWithFallback<unknown>(
    [
      `/api/skills/${encoded}/resources?${params.toString()}`,
      `/api/legacy/skills/${encoded}/resources?${params.toString()}`,
      `/api/legacy/api/skills/${encoded}/resources?${params.toString()}`,
    ],
    { method: "GET" },
  );

  return coerceArrayResponse<BackendSkillResource>(result, [
    "resources",
    "items",
    "results",
    "data",
  ]);
}
