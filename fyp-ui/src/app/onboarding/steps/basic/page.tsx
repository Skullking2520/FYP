"use client";
import { useOnboarding } from "../../_components/OnboardingProvider";
import { Progress } from "../../_components/Progress";
import { StepNav } from "../../_components/StepNav";

export default function BasicStep() {
  const { data, setData } = useOnboarding();
  const fullName = data.basic.fullName;
  const educationStage = data.basic.educationStage;

  const handleFullName = (v: string) => {
    setData("basic", { ...data.basic, fullName: v });
  };

  const handleEducationStage = (
    v: "alevel_done" | "alevel_in_progress" | "olevel_done" | "olevel_in_progress" | null,
  ) => {
    setData("basic", { ...data.basic, educationStage: v });
  };

  const canNext = fullName.trim().length > 1 && educationStage !== null;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Basic Information</h1>
      <Progress index={0} />
      <div className="rounded-2xl bg-white border shadow-sm p-5 space-y-3">
        <input className="w-full rounded-xl border px-3 py-2" placeholder="Full name"
               value={fullName} onChange={(e) => handleFullName(e.target.value)} />

        <div>
          <div className="text-sm font-medium mb-2">Education stage</div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "alevel_in_progress", label: "A-Level (in progress)" },
                { key: "alevel_done", label: "A-Level (completed)" },
                { key: "olevel_in_progress", label: "O-Level (in progress)" },
                { key: "olevel_done", label: "O-Level (completed)" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                className={`px-3 py-2 rounded-xl border ${educationStage === item.key ? "bg-blue-600 text-white border-blue-600" : ""}`}
                onClick={() => handleEducationStage(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <StepNav next="/onboarding/steps/academics" canNext={canNext} />
    </div>
  );
}
