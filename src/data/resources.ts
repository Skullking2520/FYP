import type { SkillResource } from "@/types";

export const SKILL_RESOURCES: SkillResource[] = [
  {
    skill: "Programming",
    title: "CS50x: Introduction to Computer Science",
    url: "https://cs50.harvard.edu/x",
    provider: "Harvard",
  },
  {
    skill: "Algorithms",
    title: "Grokking Algorithms",
    url: "https://www.educative.io/courses/grokking-algorithms",
    provider: "Educative",
  },
  {
    skill: "Statistics",
    title: "Practical Statistics for Data Scientists",
    url: "https://www.oreilly.com/library/view/practical-statistics-for/9781492072942/",
    provider: "O'Reilly",
  },
  {
    skill: "Machine Learning",
    title: "Andrew Ng Machine Learning Specialization",
    url: "https://www.coursera.org/specializations/machine-learning-introduction",
    provider: "Coursera",
  },
  {
    skill: "Networking",
    title: "Cisco CCNA Prep",
    url: "https://skillsforall.com/course/getting-started-cisco-packet-tracer",
    provider: "Cisco",
  },
  {
    skill: "Digital Forensics",
    title: "Intro to Digital Forensics",
    url: "https://www.udemy.com/course/digital-forensics-for-beginners/",
    provider: "Udemy",
  },
  {
    skill: "UX Research",
    title: "Google UX Research & Design",
    url: "https://grow.google/certificates/ux-design/",
    provider: "Google",
  },
  {
    skill: "Prototyping",
    title: "Figma for UX/UI Designers",
    url: "https://www.figma.com/community/file/833695548218879047",
    provider: "Figma",
  },
  {
    skill: "SQL",
    title: "Advanced SQL for Analysts",
    url: "https://mode.com/sql-tutorial",
    provider: "Mode",
  },
  {
    skill: "Data Visualization",
    title: "Storytelling with Data",
    url: "https://www.storytellingwithdata.com/",
    provider: "SWD",
  },
];

export function getResourcesForSkills(skills: string[]): SkillResource[] {
  if (skills.length === 0) return [];
  const lookup = new Set(skills.map((skill) => skill.toLowerCase()));
  return SKILL_RESOURCES.filter((resource) => lookup.has(resource.skill.toLowerCase()));
}
