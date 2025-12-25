export type AdminTopItem = {
  key: string;
  label: string;
  count: number;
};

export type AdminBucket = {
  label: string;
  count: number;
};

export type AdminSkillRecoPickPoint = {
  date: string; // YYYY-MM-DD
  total_picks: number;
  top1_picks: number;
  top5_picks: number;
  avg_chosen_rank?: number;
};

export type AdminStats = {
  generated_at?: string;

  accounts_total?: number;
  accounts_with_profile?: number;

  job_selections_total?: number;
  top_jobs?: AdminTopItem[];

  top_skills?: AdminTopItem[];

  match_score_avg?: number;
  match_score_buckets?: AdminBucket[];

  // Skill-based recommendation quality proxy.
  // Backend should populate this when pick logging is available.
  skill_reco_picks_series?: AdminSkillRecoPickPoint[];
};
