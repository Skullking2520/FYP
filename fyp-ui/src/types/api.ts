export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type UserProfile = {
  id: number;
  email: string;
  is_admin?: boolean | null;
  name?: string | null;
  age?: number | null;
  country?: string | null;
  interests_text?: string | null;
  skills_text?: string | null;
};

export type RegisterPayload = {
  email: string;
  password: string;
  name?: string;
  age?: number;
  country?: string;
};

export type JobRecommendation = {
  job_id: number;
  job_title: string;
  job_description: string;
  score: number;
};

export type MajorRecommendation = {
  major_id: number;
  major_name: string;
  university_name: string;
  description: string;
  ranking?: number | null;
  score: number;
};

export type SkillReference = {
  skill_name: string;
  skill_id?: string | null;
};

export type SkillExtractionResponse = {
  skills: SkillReference[];
};

// --- Backend skill/job APIs (FastAPI) ---
// Contract:
// 1) GET /api/skills/search?q=...
//    Response: [{id, skill_key, name, source, dimension}]
// 2) POST /api/recommend/jobs { skill_keys: string[] }
//    Response: [{job_id, title, source, matched_skills, score}]
// 3) GET /api/jobs/{job_id}
// 4) GET /api/jobs/{job_id}/skills

export type BackendSkill = {
  id: number | string;
  skill_key: string;
  name: string;
  source?: string | null;
  dimension?: string | null;
};

export type RecommendJobsRequest = {
  skill_keys: string[];
};

export type BackendJobRecommendation = {
  job_id: number | string;
  title: string;
  source?: string | null;
  matched_skills?: number | null;
  score: number;
};

// 5) GET /api/jobs/search?q=...&top_k=...
//    Response: [{ job_id, title, job_ref, esco_uri, occupation_uid, onet_soc_code, source }]
export type BackendJobSearchResult = {
  job_id: number | string;
  title: string;
  job_ref?: string | null;
  esco_uri?: string | null;
  occupation_uid?: string | null;
  onet_soc_code?: string | null;
  source?: string | null;
};

export type BackendJob = {
  job_id?: number | string;
  id?: number | string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  source?: string | null;
  [key: string]: unknown;
};

export type BackendJobSkill = {
  id?: number | string;
  skill_key?: string;
  name?: string;
  skill_name?: string;
  importance?: number | null;
  relation_type?: string | null;
  skill_type?: string | null;
  source?: string | null;
  dimension?: string | null;
  [key: string]: unknown;
};

// --- Backend major/program/resource APIs (FastAPI) ---
// 1) GET /api/jobs/{job_id}/majors?top_k=5
//    Response: [{ major_id, major_name, matched_skills, score }]
// 2) POST /api/majors/{major_id}/gaps { skill_keys: string[] } (max 200)
//    Response: [{ skill_key, name, source, dimension, importance }]
// 3) GET /api/majors/{major_id}/programs?top_k=10
//    Response: [{ program_id, program_name, university_name, ranking_source, ranking_year, rank_position, rank_band, score }]
// 4) GET /api/skills/{skill_key}/resources?top_k=10
//    Response: [{ resource_id, title, provider, type, difficulty, estimated_hours, url, description }]

export type BackendMajorRecommendation = {
  major_id: number | string;
  major_name: string;
  matched_skills: number;
  score: number;
};

export type MajorGapsRequest = {
  skill_keys: string[];
};

export type BackendMajorSkill = {
  skill_key?: string;
  name?: string;
  source?: string | null;
  dimension?: string | null;
  importance?: number | null;
  [key: string]: unknown;
};

export type BackendMajorProgramRanking = {
  program_id: number | string;
  program_name: string;
  university_name: string;
  ranking_source?: string | null;
  ranking_year?: number | null;
  rank_position?: number | null;
  rank_band?: string | null;
  score: number;
};

export type BackendSkillResource = {
  resource_id?: number | string | null;
  title: string;
  provider?: string | null;
  type?: string | null;
  difficulty?: string | null;
  estimated_hours?: number | null;
  url?: string | null;
  description?: string | null;

  // New unified learning-path contract (skill_resource_map)
  verification_status?: "VERIFIED" | "CONCEPTUAL_ONLY" | string | null;
  guidance_text?: string | null;
  priority?: number | null;
  difficulty_level?: number | null;
};

// --- Optional backend convenience endpoints ---
// 1) GET /api/users/me/pathway-summary
//    Response: { skills: [{skill_key,name,level}], desired_job?, recommended_major?, gaps? }

export type BackendPathwaySummarySkill = {
  skill_key: string;
  name?: string | null;
  level?: number | null;
};

export type BackendPathwaySummaryJob = {
  job_id: number | string;
  title?: string | null;
};

export type BackendPathwaySummaryMajor = {
  major_id: number | string;
  major_name?: string | null;
};

export type BackendPathwaySummary = {
  skills: BackendPathwaySummarySkill[];
  desired_job?: BackendPathwaySummaryJob | null;
  recommended_major?: BackendPathwaySummaryMajor | null;
  gaps?: BackendMajorSkill[];
};
