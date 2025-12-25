"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InterestsStep() {
  const router = useRouter();

  useEffect(() => {
    // Legacy route: interests step removed in the new onboarding flow.
    router.replace("/onboarding/steps/basic");
  }, [router]);

  return null;
}
