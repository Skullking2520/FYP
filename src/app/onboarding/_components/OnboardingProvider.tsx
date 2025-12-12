"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { OnboardingData } from "./types";

type Ctx = {
  data: OnboardingData;
  setData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  reset: () => void;
};

const defaultData: OnboardingData = {
  basic: { fullName: "", country: "", age: null },
  interests: { areas: [], studyStyle: null },
  academics: { mathLevel: null, csTaken: false, gradesNote: "" },
  career: { targetJobs: [], notes: "" },
};

const KEY = "onboardingData";
const C = createContext<Ctx | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setState] = useState<OnboardingData>(() => {
    if (typeof window === "undefined") return defaultData;
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? { ...defaultData, ...JSON.parse(raw) } : defaultData;
    } catch {
      return defaultData;
    }
  });

  // 저장 (첫 마운트는 스킵)
  const didMount = useRef(false);
  useEffect(() => {
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
