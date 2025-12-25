"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CareerStep() {
  const router = useRouter();

  useEffect(() => {
    // Legacy route: career goals moved into the About step in the new flow.
    router.replace("/onboarding/steps/about");
  }, [router]);

  return null;
}
