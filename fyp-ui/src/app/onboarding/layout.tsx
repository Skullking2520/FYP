// src/app/onboarding/layout.tsx
import { OnboardingProvider } from "./_components/OnboardingProvider";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <div className="p-6 max-w-3xl mx-auto">{children}</div>
    </OnboardingProvider>
  );
}
