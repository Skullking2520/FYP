// src/app/onboarding/_components/types.ts
export type BasicInfo = {
  fullName: string;
  country: string;
  age: number | null;
};

export type Interests = {
  areas: string[]; // e.g., ["AI","Data","Cybersecurity"]
  studyStyle: "project" | "research" | "exam" | null;
};

export type Academics = {
  mathLevel: "low" | "mid" | "high" | null;
  csTaken: boolean;
  gradesNote: string; // free text
};

export type CareerGoals = {
  targetJobs: string[]; // ["Data Scientist","Game Dev"...]
  notes: string;
};

export type OnboardingData = {
  basic: BasicInfo;
  interests: Interests;
  academics: Academics;
  career: CareerGoals;
};
