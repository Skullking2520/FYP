// src/app/onboarding/steps/interests/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useOnboarding } from "../../_components/OnboardingProvider";
import { Progress } from "../../_components/Progress";
import { StepNav } from "../../_components/StepNav";

const AREAS = ["AI", "Data", "Software Engineering", "Cybersecurity", "Networks", "Game Dev", "UX/UI"];

export default function InterestsStep() {
  const { data, setData } = useOnboarding();
  const [areas, setAreas] = useState<string[]>(data.interests.areas);
  const [studyStyle, setStudyStyle] = useState<"project" | "research" | "exam" | null>(data.interests.studyStyle);

  useEffect(() => {
    setData("interests", { areas, studyStyle });
  }, [areas, studyStyle, setData]);

  const toggleArea = (a: string) =>
    setAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const canNext = areas.length > 0 && !!studyStyle;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Interests & Aptitude</h1>
      <Progress index={1} />
      <div className="rounded-2xl bg-white border shadow-sm p-5 space-y-4">
        <div>
          <div className="text-sm font-medium mb-2">Select areas you’re interested in</div>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <button key={a}
                className={`px-3 py-2 rounded-xl border ${areas.includes(a) ? "bg-blue-600 text-white border-blue-600" : ""}`}
                onClick={() => toggleArea(a)}
              >{a}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Preferred study style</div>
          <div className="flex gap-2">
            {(["project", "research", "exam"] as const).map((s) => (
              <button key={s}
                className={`px-3 py-2 rounded-xl border capitalize ${studyStyle === s ? "bg-blue-600 text-white border-blue-600" : ""}`}
                onClick={() => setStudyStyle(s)}
              >{s}</button>
            ))}
          </div>
        </div>
      </div>
      <StepNav prev="/onboarding/steps/basic" next="/onboarding/steps/academics" canNext={canNext} />
    </div>
  );
}
