// src/app/onboarding/page.tsx
import { redirect } from "next/navigation";

export default function OnboardingIndex() {
  // 단순히 첫 단계로
  redirect("/onboarding/steps/basic");
}