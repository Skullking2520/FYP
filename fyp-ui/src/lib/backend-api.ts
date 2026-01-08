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
  BackendSkillResolveItem,
  BackendSkillResolveResponse,
  MajorGapsRequest,
  RecommendJobsRequest,
  SkillExtractionResponse,
  BackendPathwaySummary,
} from "@/types/api";

export class BackendRequestError extends Error {
  status: number;
  path: string;
  detail: unknown;

  constructor(message: string, args: { status: number; path: string; detail: unknown }) {
    super(message);
    this.name = "BackendRequestError";
    this.status = args.status;
    this.path = args.path;
    this.detail = args.detail;
  }
}

function looksLikeStackTrace(message: string): boolean {
  const s = message.trim();
  if (!s) return false;
  return (
    s.includes("Traceback") ||
    s.includes("UnboundLocalError") ||
    s.includes("anyio/_backends") ||
    s.includes("/site-packages/") ||
    s.includes("/app/") ||
    /\bFile\s+".*",\s+line\s+\d+/.test(s)
  );
}

function toSafeBackendErrorMessage(status: number, detail: unknown): string {
  // Never surface raw stack traces / internal file paths to end users.
  const generic = status >= 500 ? "Server error. Please try again later." : `Request failed with status ${status}`;

  if (typeof detail !== "string") return generic;
  const cleaned = detail.replace(/\s+/g, " ").trim();
  if (!cleaned) return generic;
  if (looksLikeStackTrace(cleaned)) return generic;

  // Avoid extremely long backend messages in UI.
  return cleaned.length > 200 ? generic : cleaned;
}

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
    let detail: unknown = undefined;
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as unknown;
      detail = body;
      if (body && typeof body === "object" && "detail" in body) {
        const maybeDetail = (body as Record<string, unknown>).detail;
        if (typeof maybeDetail === "string") {
          message = toSafeBackendErrorMessage(response.status, maybeDetail);
        }
      }
    } catch {
      // ignore JSON parse errors
    }

    // Keep full detail for debugging without leaking to users.
    if (detail) {
      console.error("Backend request failed", { path, status: response.status, detail });
    }
    throw new BackendRequestError(message, { status: response.status, path, detail });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

type BackendOkResponse<T> = {
  value: T;
  headers: Headers;
};

async function backendFetchOkWithHeaders<T>(path: string, init: RequestInit = {}): Promise<BackendOkResponse<T>> {
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
    let detail: unknown = undefined;
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as unknown;
      detail = body;
      if (body && typeof body === "object" && "detail" in body) {
        const maybeDetail = (body as Record<string, unknown>).detail;
        if (typeof maybeDetail === "string") {
          message = toSafeBackendErrorMessage(response.status, maybeDetail);
        }
      }
    } catch {
      // ignore JSON parse errors
    }

    if (detail) {
      console.error("Backend request failed", { path, status: response.status, detail });
    }
    throw new BackendRequestError(message, { status: response.status, path, detail });
  }

  if (response.status === 204) {
    return { value: undefined as T, headers: response.headers };
  }

  return { value: (await response.json()) as T, headers: response.headers };
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

  // Common wrapper shapes: { value: {...} } / { data: {...} }
  // Recurse once so callers can pass the raw response.
  const wrapped = record.value ?? record.data;
  if (wrapped && typeof wrapped === "object") {
    const inner = coerceArrayResponse<T>(wrapped, candidateKeys);
    if (inner.length > 0) return inner;
  }

  for (const key of candidateKeys) {
    const maybe = record[key];
    if (Array.isArray(maybe)) return maybe as T[];
  }
  return [];
}

const skillSearchCache = new Map<string, BackendSkill[]>();
const jobSearchCache = new Map<string, BackendJobSearchResult[]>();
const skillResolveCache = new Map<string, BackendSkillResolveItem>();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function strongSkillSearchMatch(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const t = text.toLowerCase();

  // For very short queries ("ch"), allow substring matches too.
  // Some backends legitimately return matches inside a word for short queries.
  if (q.length <= 2) {
    if (t.includes(q)) return true;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(q)}`);
    return re.test(t);
  }

  return t.includes(q);
}

function responseLooksFiltered(items: BackendSkill[], query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (items.length === 0) return true;

  const headN = Math.min(20, items.length);
  let headHits = 0;
  let totalHits = 0;

  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    const name = typeof s?.name === "string" ? s.name : "";
    const key = typeof s?.skill_key === "string" ? s.skill_key : "";
    const hit = strongSkillSearchMatch(name, q) || strongSkillSearchMatch(key, q);
    if (hit) {
      totalHits += 1;
      if (i < headN) headHits += 1;
    }
  }

  if (totalHits === 0) return false;
  // Heuristic: a real search should surface at least one strong match near the top.
  if (q.length <= 2) return headHits >= 1;
  return headHits >= 1;
}

export async function searchSkills(q: string): Promise<BackendSkill[]> {
  const query = q.trim();
  if (!query) return [];

  const cached = skillSearchCache.get(query);
  if (cached) return cached;

  // Backends differ on query param name and some deployments silently ignore unknown params.
  // We try common variants and *prefer* the first response that actually matches the query.
  const safeTopK = "50";
  const attempts: Array<{ label: string; url: string }> = [
    { label: "q", url: `/api/skills/search?${new URLSearchParams({ q: query, top_k: safeTopK }).toString()}` },
    { label: "query", url: `/api/skills/search?${new URLSearchParams({ query: query, top_k: safeTopK }).toString()}` },
    { label: "name", url: `/api/skills/search?${new URLSearchParams({ name: query, top_k: safeTopK }).toString()}` },
  ];

  let lastResult: BackendSkill[] = [];
  let lastError: unknown = null;

  for (const a of attempts) {
    try {
      const raw = await backendFetch<unknown>(a.url, { method: "GET" });
      const result = coerceArrayResponse<BackendSkill>(raw, ["skills", "items", "results", "data", "value"]);
      lastResult = result;

      // Prefer the first attempt that looks like it actually applied filtering.
      if (responseLooksFiltered(result, query)) {
        skillSearchCache.set(query, result);
        return result;
      }
    } catch (err) {
      lastError = err;
    }
  }

  // If every attempt looked unfiltered, don't return a noisy default page.
  // Surface a clear error so the UI can prompt a backend fix.
  if (lastResult.length > 0) {
    throw new Error("Skill search returned unfiltered results (query ignored). Please contact the backend team.");
  }

  throw (lastError instanceof Error ? lastError : new Error("Failed to search skills"));
}

export async function resolveSkill(skill_key: string): Promise<BackendSkillResolveItem> {
  const key = skill_key.trim();
  if (!key) return { skill_key: "", skill_name: null, resolved: false };

  const cached = skillResolveCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ skill_key: key });
  const response = await backendFetch<BackendSkillResolveResponse>(`/api/skills/resolve?${params.toString()}`, {
    method: "GET",
  });

  const items = Array.isArray(response?.items) ? response.items : [];
  const hit = items.find((i) => i && typeof i.skill_key === "string" && i.skill_key === key) ?? {
    skill_key: key,
    skill_name: null,
    resolved: false,
  };

  skillResolveCache.set(key, hit);
  return hit;
}

export async function resolveSkills(skill_keys: string[]): Promise<BackendSkillResolveItem[]> {
  const uniqueKeys = Array.from(
    new Set(
      (Array.isArray(skill_keys) ? skill_keys : [])
        .map((k) => (typeof k === "string" ? k.trim() : ""))
        .filter((k) => k.length > 0),
    ),
  );

  if (uniqueKeys.length === 0) return [];

  const missing = uniqueKeys.filter((k) => !skillResolveCache.has(k));

  if (missing.length > 0) {
    const payload = { skill_keys: missing };
    const response = await backendFetch<BackendSkillResolveResponse>("/api/skills/resolve", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const items = Array.isArray(response?.items) ? response.items : [];
    for (const k of missing) {
      const hit =
        items.find((i) => i && typeof i.skill_key === "string" && i.skill_key === k) ??
        ({ skill_key: k, skill_name: null, resolved: false } satisfies BackendSkillResolveItem);
      skillResolveCache.set(k, hit);
    }
  }

  return uniqueKeys.map((k) => skillResolveCache.get(k) ?? ({ skill_key: k, skill_name: null, resolved: false } satisfies BackendSkillResolveItem));
}

export async function recommendJobs(skill_keys: string[]): Promise<BackendJobRecommendation[]> {
  const payload: RecommendJobsRequest = { skill_keys };
  return backendFetch<BackendJobRecommendation[]>("/api/recommend/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type RecommendJobsTrackingResult = {
  items: BackendJobRecommendation[];
  recommendation_id: string | null;
};

export async function recommendJobsWithTracking(
  skill_keys: string[],
  token?: string | null,
): Promise<RecommendJobsTrackingResult> {
  const payload: RecommendJobsRequest = { skill_keys };
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const { value, headers: responseHeaders } = await backendFetchOkWithHeaders<BackendJobRecommendation[]>(
    "/api/recommend/jobs",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
  );

  const recommendation_id = responseHeaders.get("X-Recommendation-Id");

  return {
    items: Array.isArray(value) ? value : [],
    recommendation_id: recommendation_id && recommendation_id.trim() ? recommendation_id.trim() : null,
  };
}

export async function logRecommendJobPick(
  recommendation_id: string,
  chosen_job_id: string | number,
  token?: string | null,
): Promise<void> {
  const recId = recommendation_id.trim();
  if (!recId) return;
  const jobId = String(chosen_job_id);
  if (!jobId.trim()) return;

  const body = JSON.stringify({ recommendation_id: recId, chosen_job_id: jobId });

  const tryOnce = async (authToken?: string | null): Promise<Response> => {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
    return fetch("/api/recommend/jobs/pick", {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      // Best-effort logging during navigation.
      keepalive: true,
    });
  };

  const first = await tryOnce(token);
  if (first.ok) return;

  // Backend behavior: if Authorization is present but invalid/expired => 401.
  // To still count the pick, retry without auth.
  if (first.status === 401 && token) {
    const second = await tryOnce(null);
    if (second.ok) return;
    throw new Error(`Request failed with status ${second.status}`);
  }

  throw new Error(`Request failed with status ${first.status}`);
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

  return backendFetchWithFallback<SkillExtractionResponse>(
    [
      "/api/recommend/nlp/extract-skills",
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

  const raw = await backendFetchWithFallback<unknown>(
    ["/api/legacy/users/me/pathway-summary"],
    { method: "GET", headers },
  );

  // Some deployments wrap responses: { value: {...} }
  const candidate = (() => {
    if (!raw || typeof raw !== "object") return raw;
    const record = raw as Record<string, unknown>;
    const v = record.value;
    if (v && typeof v === "object") return v;
    const d = record.data;
    if (d && typeof d === "object") return d;
    return raw;
  })();

  const skills = coerceArrayResponse<BackendPathwaySummary["skills"][number]>(candidate, [
    "skills",
    "items",
    "results",
    "data",
    "value",
  ]);

  const desired_job =
    candidate && typeof candidate === "object" && (candidate as Record<string, unknown>).desired_job
      ? ((candidate as Record<string, unknown>).desired_job as BackendPathwaySummary["desired_job"])
      : null;

  const recommended_major =
    candidate && typeof candidate === "object" && (candidate as Record<string, unknown>).recommended_major
      ? ((candidate as Record<string, unknown>).recommended_major as BackendPathwaySummary["recommended_major"])
      : null;

  const gaps = coerceArrayResponse<BackendMajorSkill>(candidate, [
    "gaps",
    "missing_skills",
    "missingSkills",
    "gap_skills",
    "gapSkills",
    "value",
  ]);

  return {
    skills: Array.isArray(skills) ? skills : [],
    desired_job,
    recommended_major,
    gaps: Array.isArray(gaps) ? gaps : undefined,
  } satisfies BackendPathwaySummary;
}

export async function getJob(job_id: string): Promise<BackendJob> {
  const encoded = encodeURIComponent(job_id);
  return backendFetchWithFallback<BackendJob>(
    [
      `/api/jobs/${encoded}`,
    ],
    { method: "GET" },
  );
}

export async function getJobSkills(job_id: string): Promise<BackendJobSkill[]> {
  const encoded = encodeURIComponent(job_id);
  return backendFetchWithFallback<BackendJobSkill[]>(
    [
      `/api/jobs/${encoded}/skills`,
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
    ],
    { method: "GET" },
  );
}

export async function getMajorGaps(
  major_id: string,
  skill_keys: string[],
  token?: string | null,
): Promise<BackendMajorSkill[]> {
  const payload: MajorGapsRequest = { skill_keys: skill_keys.slice(0, 200) };
  const encoded = encodeURIComponent(major_id);
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const result = await backendFetchWithFallback<unknown>(
    [
      `/api/majors/${encoded}/gaps`,
    ],
    {
      method: "POST",
      headers,
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
    "value",
  ]);
}

export async function getMajorPrograms(major_id: string, top_k = 10): Promise<BackendMajorProgramRanking[]> {
  const params = new URLSearchParams({ top_k: String(top_k) });
  const encoded = encodeURIComponent(major_id);
  const result = await backendFetchWithFallback<unknown>(
    [
      `/api/majors/${encoded}/programs?${params.toString()}`,
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

export async function getSkillDetail(skill_key: string): Promise<BackendSkill | null> {
  const key = (typeof skill_key === "string" ? skill_key : "").trim();
  if (!key) return null;

  // Backend supports ESCO URIs (slashes) via `{skill_ref:path}`.
  // Many servers won't decode `%2F` back into `/`, so encode per path segment
  // and keep slashes as delimiters.
  const encoded = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");

  // Prefer query-param forms to avoid proxy/server normalization issues with `http://...` in paths.
  const qp = new URLSearchParams({ skill_ref: key });
  const qpKey = new URLSearchParams({ skill_key: key });

  const isUriLike = key.includes("://");

  const candidates: string[] = [
    // Preferred contract
    `/api/skills/detail?${qp.toString()}`,
    `/api/skills/detail?${qpKey.toString()}`,
  ];

  // Only try path-based endpoints for non-URI keys.
  // URI-like keys frequently hit 308/404 due to `//` normalization and `%2F` handling.
  if (!isUriLike) {
    candidates.push(
      `/api/skills/${encoded}`,
      `/api/skills/detail/${encoded}`,
    );
  }

  const result = await backendFetchWithFallback<unknown>(candidates, { method: "GET" });

  if (!result || typeof result !== "object") return null;
  return result as BackendSkill;
}
