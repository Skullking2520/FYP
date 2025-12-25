"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getProfile, loginRequest } from "@/lib/api";
import type { UserProfile } from "@/types/api";

const TOKEN_STORAGE_KEY = "careerpath_access_token";

type AuthContextValue = {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: (overrideToken?: string) => Promise<UserProfile | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const persistToken = useCallback((value: string | null) => {
    if (typeof window === "undefined") {
      return;
    }
    if (value) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, []);

  const refreshProfile = useCallback(
    async (overrideToken?: string) => {
      const activeToken = overrideToken ?? token;
      if (!activeToken) {
        setUser(null);
        return null;
      }
      try {
        const profile = await getProfile(activeToken);
        setUser(profile);
        return profile;
      } catch (error) {
        console.error("Failed to refresh profile", error);
        persistToken(null);
        setToken(null);
        setUser(null);
        return null;
      }
    },
    [token, persistToken],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      setToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    refreshProfile(token).finally(() => setLoading(false));
  }, [token, refreshProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const result = await loginRequest(email, password);
        persistToken(result.access_token);
        setToken(result.access_token);
        await refreshProfile(result.access_token);
      } finally {
        setLoading(false);
      }
    },
    [persistToken, refreshProfile],
  );

  const logout = useCallback(() => {
    persistToken(null);
    setToken(null);
    setUser(null);
  }, [persistToken]);

  const value = useMemo(
    () => ({ token, user, loading, login, logout, refreshProfile }),
    [token, user, loading, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
