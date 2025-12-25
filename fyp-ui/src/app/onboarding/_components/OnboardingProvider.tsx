"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { OnboardingData } from "./types";

type Ctx = {
  data: OnboardingData;
  setData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  reset: () => void;
};

const defaultData: OnboardingData = {
  basic: { fullName: "", educationStage: null },
  interests: { areas: [], studyStyle: null },
  academics: { mathLevel: null, csTaken: false, subjects: [], mappedSkills: [], subjectsNote: "", gradesNote: "" },
  about: { hobbies: "", selfIntro: "", extractedSkills: [] },
  career: { targetJobs: [], notes: "" },
};

const KEY = "onboardingData";
const C = createContext<Ctx | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: to avoid hydration mismatches, we must render the same markup on
  // server and on the first client render. So we always start from defaultData
  // and then hydrate from localStorage after mount.
  const [data, setState] = useState<OnboardingData>(defaultData);

  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<OnboardingData>;
      setState({
        ...defaultData,
        ...parsed,
        basic: { ...defaultData.basic, ...(parsed.basic ?? {}) },
        interests: { ...defaultData.interests, ...(parsed.interests ?? {}) },
        academics: { ...defaultData.academics, ...(parsed.academics ?? {}) },
        about: { ...defaultData.about, ...(parsed.about ?? {}) },
        career: { ...defaultData.career, ...(parsed.career ?? {}) },
      });
    } catch {
      // ignore invalid storage
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  // 저장 (첫 마운트는 스킵)
  const didMount = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch {}
  }, [data]);

  // ✅ 안정적인 setter
  const setPartial = useCallback(<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setState(defaultData), []);

  const api = useMemo<Ctx>(() => ({ data, setData: setPartial, reset }), [data, setPartial, reset]);

  return <C.Provider value={api}>{children}</C.Provider>;
}

export const useOnboarding = () => {
  const v = useContext(C);
  if (!v) throw new Error("useOnboarding must be used within OnboardingProvider");
  return v;
};
