import type { Program, ProgramId } from "@/types";

export const PROGRAMS: Program[] = [
  {
    id: "cs",
    name: "Computer Science",
    description: "Core computing foundation covering systems, algorithms, and software engineering for broad tech careers.",
    tags: ["Algorithms", "Systems", "Math-heavy", "Project-based"],
    difficulty: "heavy",
    studyStyle: "project",
    focusAreas: ["Operating Systems", "Distributed Systems", "Software Engineering"],
    regions: ["malaysia", "singapore", "global"],
  },
  {
    id: "ds",
    name: "Data Science",
    description: "Statistics-driven program blending machine learning, analytics, and storytelling with data.",
    tags: ["AI", "Statistics", "Math-heavy", "Research"],
    difficulty: "heavy",
    studyStyle: "research",
    focusAreas: ["Machine Learning", "Data Engineering", "Business Intelligence"],
    regions: ["malaysia", "singapore", "global"],
  },
  {
    id: "cyber",
    name: "Cybersecurity & Digital Forensics",
    description: "Security-first curriculum focusing on defensive operations, incident response, and governance.",
    tags: ["Security", "Networks", "Hands-on", "Exam"],
    difficulty: "medium",
    studyStyle: "exam",
    focusAreas: ["Offensive Security", "Threat Hunting", "Digital Forensics"],
    regions: ["malaysia", "singapore"],
  },
  {
    id: "ux",
    name: "UX Design & Interactive Media",
    description: "Human-centered design degree emphasizing prototyping, research, and multi-platform experiences.",
    tags: ["Design", "Research", "Studio", "Creative"],
    difficulty: "medium",
    studyStyle: "project",
    focusAreas: ["Product Design", "UX Research", "Visual Storytelling"],
    regions: ["malaysia", "global", "online"],
  },
];

const programMap = new Map<ProgramId, Program>(PROGRAMS.map((program) => [program.id, program]));

export function getProgramById(id: ProgramId): Program | undefined {
  return programMap.get(id);
}
