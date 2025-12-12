// src/app/onboarding/steps/academics/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useOnboarding } from "../../_components/OnboardingProvider";
import { Progress } from "../../_components/Progress";
import { StepNav } from "../../_components/StepNav";

export default function AcademicsStep() {
  const { data, setData } = useOnboarding();
  const [mathLevel, setMathLevel] = useState<"low"|"mid"|"high"|null>(data.academics.mathLevel);
  const [csTaken, setCsTaken] = useState<boolean>(data.academics.csTaken);
  const [gradesNote, setGradesNote] = useState<string>(data.academics.gradesNote);

  useEffect(() => {
    setData("academics", { mathLevel, csTaken, gradesNote });
  }, [mathLevel, csTaken, gradesNote, setData]);

  const canNext = !!mathLevel;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Academics</h1>
      <Progress index={2} />
      <div className="rounded-2xl bg-white border shadow-sm p-5 space-y-4">
        <div>
          <div className="text-sm font-medium mb-2">Math level</div>
          <div className="flex gap-2">
            {(["low","mid","high"] as const).map((lvl) => (
              <button key={lvl}
                className={`px-3 py-2 rounded-xl border uppercase ${mathLevel === lvl ? "bg-blue-600 text-white border-blue-600" : ""}`}
                onClick={() => setMathLevel(lvl)}
              >{lvl}</button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={csTaken} onChange={(e)=>setCsTaken(e.target.checked)} />
          I have taken Computer Science / Programming courses
        </label>
        <textarea
          className="w-full rounded-xl border px-3 py-2 min-h-[100px]"
          placeholder="Grades / subjects summary (optional)"
          value={gradesNote}
          onChange={(e)=>setGradesNote(e.target.value)}
        />
      </div>
      <StepNav prev="/onboarding/steps/interests" next="/onboarding/steps/career" canNext={canNext} />
    </div>
  );
}
