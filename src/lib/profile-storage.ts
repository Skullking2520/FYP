import type { UserProfile } from "@/types";
import { buildUserProfile } from "./match";

const PROFILE_KEY = "userProfile";
const ONBOARDING_KEY = "onboardingData";

export function saveProfileToLocal(profile: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {}
}

export function loadStoredProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.localStorage.getItem(PROFILE_KEY);
    if (cached) {
      return JSON.parse(cached) as UserProfile;
    }
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    const profile = buildUserProfile(JSON.parse(raw));
    saveProfileToLocal(profile);
    return profile;
  } catch {
    return null;
  }
}
