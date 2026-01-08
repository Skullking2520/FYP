// src/app/onboarding/_components/types.ts
export type BasicInfo = {
  fullName: string;
  educationStage: "alevel_done" | "alevel_in_progress" | "olevel_done" | "olevel_in_progress" | null;
};

export type Interests = {
  areas: string[]; // e.g., ["AI","Data","Cybersecurity"]
  studyStyle: "project" | "research" | "exam" | null;
};

export type Academics = {
  mathLevel: "low" | "mid" | "high" | null;
  csTaken: boolean;
  subjects: { level: "olevel" | "alevel"; name: string; grade: string }[];
  mappedSkills?: { skill_key: string; level: number }[];
  subjectsNote: string; // legacy free text (optional)
  gradesNote: string; // legacy free text (optional)
};

export type CareerGoals = {
  targetJobs: string[]; // ["Data Scientist","Game Dev"...]
  notes: string;
};

export type AboutYou = {
  hobbies: string;
  selfIntro: string;
  extractedSkills?: { skill_name: string; skill_id?: string | null }[];
};

export type OnboardingData = {
  basic: BasicInfo;
  interests: Interests;
  academics: Academics;
  about: AboutYou;
  career: CareerGoals;
};
