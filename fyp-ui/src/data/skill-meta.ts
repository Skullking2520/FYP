export type SkillCategory =
  | "Programming"
  | "Math"
  | "Data"
  | "Systems"
  | "Security"
  | "Design"
  | "General";

export type SkillDifficulty = "easy" | "medium" | "hard" | "unknown";

export type SkillMeta = {
  category: SkillCategory;
  difficulty: SkillDifficulty;
};

// Minimal, UI-only metadata for filtering.
// Keyed by lowercased skill name to remain backend-agnostic.
export const SKILL_META_BY_NAME: Record<string, SkillMeta> = {
  // Programming
  "programming": { category: "Programming", difficulty: "easy" },
  "python": { category: "Programming", difficulty: "easy" },
  "java": { category: "Programming", difficulty: "medium" },
  "javascript": { category: "Programming", difficulty: "easy" },
  "typescript": { category: "Programming", difficulty: "medium" },
  "data structures": { category: "Programming", difficulty: "medium" },
  "algorithms": { category: "Programming", difficulty: "hard" },

  // Math
  "discrete math": { category: "Math", difficulty: "medium" },
  "calculus": { category: "Math", difficulty: "medium" },
  "linear algebra": { category: "Math", difficulty: "medium" },
  "statistics": { category: "Math", difficulty: "medium" },

  // Data
  "sql": { category: "Data", difficulty: "easy" },
  "data visualization": { category: "Data", difficulty: "easy" },
  "machine learning": { category: "Data", difficulty: "hard" },
  "data engineering": { category: "Data", difficulty: "hard" },
  "databases": { category: "Data", difficulty: "medium" },

  // Systems
  "linux": { category: "Systems", difficulty: "medium" },
  "networking": { category: "Systems", difficulty: "medium" },
  "operating systems": { category: "Systems", difficulty: "hard" },
  "computer systems": { category: "Systems", difficulty: "hard" },

  // Security
  "cryptography": { category: "Security", difficulty: "hard" },
  "security operations": { category: "Security", difficulty: "medium" },
  "digital forensics": { category: "Security", difficulty: "hard" },
  "risk management": { category: "Security", difficulty: "medium" },

  // Design
  "figma": { category: "Design", difficulty: "easy" },
  "ui design": { category: "Design", difficulty: "medium" },
  "ux research": { category: "Design", difficulty: "medium" },
  "wireframing": { category: "Design", difficulty: "easy" },
  "prototyping": { category: "Design", difficulty: "easy" },
  "usability testing": { category: "Design", difficulty: "medium" },
  "interaction design": { category: "Design", difficulty: "hard" },
  "human factors": { category: "Design", difficulty: "hard" },
  "storytelling": { category: "Design", difficulty: "easy" },
  "collaboration": { category: "General", difficulty: "easy" },
};

export function lookupSkillMetaByName(skillName: string): SkillMeta {
  const key = skillName.trim().toLowerCase();
  return SKILL_META_BY_NAME[key] ?? { category: "General", difficulty: "unknown" };
}
