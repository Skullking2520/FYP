export type StudyStyle = "project" | "research" | "exam";
export type Difficulty = "light" | "medium" | "heavy";
export type Region = "malaysia" | "singapore" | "global" | "online";
export type ProgramId = "cs" | "ds" | "cyber" | "ux" | string;
export type UniversityId = "apu" | "um" | "nus" | "monash" | "taylors" | "sunway" | "swinburne" | "ntu" | "oxford" | string;

export type Program = {
  id: ProgramId;
  name: string;
  description: string;
  tags: string[];
  difficulty: Difficulty;
  studyStyle: StudyStyle;
  focusAreas: string[];
  regions: Region[];
};

export type ProgramRecommendation = Program & {
  matchScore: number;
  reasonTags: string[];
};

export type UniversityProgram = {
  uniId: UniversityId;
  uniName: string;
  programUrl: string;
  rank?: number;
  region: Region;
  requiredSkills: string[];
  entryRequirements: string[];
  studyStyle: StudyStyle;
  difficulty: Difficulty;
};

export type SkillResource = {
  skill: string;
  title: string;
  url: string;
  provider: string;
};

export type GapAnalysis = {
  missing: string[];
  covered: string[];
};

export type UserProfile = {
  interests: string[];
  mathLevel: "low" | "mid" | "high" | null;
  csTaken: boolean;
  studyStyle?: StudyStyle | null;
};

export type JobSuggestion = {
  id: string;
  title: string;
  reason: string[];
};

export type ProgramFilters = {
  region?: Region | "all";
  studyStyle?: StudyStyle | "all";
  difficulty?: Difficulty | "all";
};

export type ProgramSort = "match" | "math-first" | "study-style";

export type RecommendationOptions = ProgramFilters & {
  sort?: ProgramSort;
};
