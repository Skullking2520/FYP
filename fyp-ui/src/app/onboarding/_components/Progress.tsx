// src/app/onboarding/_components/Progress.tsx
"use client";
const steps = ["Basic", "Academics", "About", "Skills"] as const;
export function Progress({ index }: { index: number }) {
  const pct = ((index + 1) / steps.length) * 100;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>Step {index + 1} / {steps.length}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full mt-2">
        <div className="h-2 bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
