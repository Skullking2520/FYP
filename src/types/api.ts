export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type UserProfile = {
  id: number;
  email: string;
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

// --- Backend major recommendation / gap analysis APIs (FastAPI) ---
// 1) GET /api/jobs/{job_id}/majors?top_k=5
//    Response: [{major_id, major_name, matched_skills, score}]
// 2) GET /api/majors/{major_id}/skills
//    Response: required skills ordered by importance desc
// 3) POST /api/majors/{major_id}/gaps { skill_keys: string[] }
//    Response: missing skills ordered by importance desc

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
  id?: number | string;
  skill_key?: string;
  name?: string;
  skill_name?: string;
  importance?: number | null;
  source?: string | null;
  dimension?: string | null;
  [key: string]: unknown;
};
