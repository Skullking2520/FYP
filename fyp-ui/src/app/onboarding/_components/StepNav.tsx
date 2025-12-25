// src/app/onboarding/_components/StepNav.tsx
"use client";
import { useRouter } from "next/navigation";

export function StepNav({
  prev,
  next,
  nextLabel = "Next",
  canNext = true,
  onNext,
}: {
  prev?: string;
  next?: string;
  nextLabel?: string;
  canNext?: boolean;
  onNext?: () => void;
}) {
  const router = useRouter();
  return (
    <div className="mt-6 flex gap-3">
      {prev && (
        <button className="px-4 py-2 rounded-xl border" onClick={() => router.push(prev)}>
          Back
        </button>
      )}
      {next && (
        <button
          disabled={!canNext}
          className={`px-4 py-2 rounded-xl text-white ${canNext ? "bg-blue-600" : "bg-slate-400 cursor-not-allowed"}`}
          onClick={() => {
            onNext?.();
            router.push(next);
          }}
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
