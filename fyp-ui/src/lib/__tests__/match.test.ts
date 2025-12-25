import { analyzeGaps, buildUserProfile, suggestJobsBySkills, userSkillKeywords } from "@/lib/match";
import type { UserProfile } from "@/types";

describe("buildUserProfile", () => {
  it("returns defaults for malformed input", () => {
    expect(buildUserProfile(null)).toEqual({ interests: [], mathLevel: null, csTaken: false });
  });

  it("parses valid onboarding payloads", () => {
    const raw = {
      interests: { areas: ["AI", "Data"], studyStyle: "project" },
      academics: { mathLevel: "high", csTaken: true },
    };
    expect(buildUserProfile(raw)).toEqual({
      interests: ["AI", "Data"],
      mathLevel: "high",
      csTaken: true,
      studyStyle: "project",
    });
  });
});

describe("suggestJobsBySkills", () => {
  it("suggests ML roles when AI interest and math strength align", () => {
    const profile: UserProfile = { interests: ["AI"], mathLevel: "high", csTaken: true, studyStyle: "project" };
    const results = suggestJobsBySkills(profile);
    const ids = results.map((item) => item.id);
    expect(ids).toContain("data-scientist");
    expect(ids).toContain("ml-engineer");
  });

  it("falls back to IT analyst when no interest provided", () => {
    const profile: UserProfile = { interests: [], mathLevel: null, csTaken: false, studyStyle: null };
    const results = suggestJobsBySkills(profile);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("it-analyst");
  });
});

describe("analyzeGaps", () => {
  it("matches skills case-insensitively", () => {
    const required = ["Programming", "Algorithms", "Networking"];
    const user = ["programming", "Networking"];
    const result = analyzeGaps(required, user);
    expect(result.covered).toEqual(["Programming", "Networking"]);
    expect(result.missing).toEqual(["Algorithms"]);
  });
});

describe("userSkillKeywords", () => {
  it("adds math keywords based on math level", () => {
    const profile: UserProfile = { interests: ["AI"], mathLevel: "high", csTaken: true, studyStyle: "project" };
    const keywords = userSkillKeywords(profile);
    expect(keywords).toEqual(
      expect.arrayContaining(["AI", "Programming", "Algorithms", "Calculus", "Statistics", "Linear Algebra"]),
    );
  });
});
