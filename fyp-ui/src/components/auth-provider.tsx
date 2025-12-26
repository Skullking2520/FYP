"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getProfile, loginRequest } from "@/lib/api";
import { isAdminUserEmail } from "@/lib/admin";
import type { UserProfile } from "@/types/api";

const TOKEN_STORAGE_KEY = "careerpath_access_token";
const LOGIN_EMAIL_STORAGE_KEY = "careerpath_login_email";

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = atob(padded);
    const obj = JSON.parse(json) as unknown;
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function getStringClaim(payload: Record<string, unknown> | null, keys: string[]): string | null {
  if (!payload) return null;
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function hasAdminClaim(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  if (payload["is_admin"] === true) return true;
  if (payload["isAdmin"] === true) return true;
  if (payload["is_superuser"] === true) return true;
  if (payload["isSuperuser"] === true) return true;
  if (payload["is_staff"] === true) return true;
  const role = payload["role"];
  if (typeof role === "string" && role.toLowerCase() === "admin") return true;
  const roles = payload["roles"];
  if (Array.isArray(roles) && roles.some((r) => typeof r === "string" && r.toLowerCase() === "admin")) return true;
  return false;
}

async function probeAdminAccess(token: string): Promise<boolean> {
  const paths = ["/api/admin/stats", "/api/legacy/admin/stats", "/api/legacy/api/admin/stats"];
  let sawAuthFailure = false;
  for (const path of paths) {
    try {
      const res = await fetch(path, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) return true;
      if (res.status === 401 || res.status === 403) {
        sawAuthFailure = true;
        continue;
      }
    } catch {
      // ignore and try next path
    }
  }
  return sawAuthFailure ? false : false;
}

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

  const persistLoginEmail = useCallback((email: string | null) => {
    if (typeof window === "undefined") return;
    const trimmed = (email ?? "").trim();
    if (trimmed) {
      window.localStorage.setItem(LOGIN_EMAIL_STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(LOGIN_EMAIL_STORAGE_KEY);
    }
  }, []);

  const getPersistedLoginEmail = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LOGIN_EMAIL_STORAGE_KEY);
    const trimmed = (raw ?? "").trim();
    return trimmed ? trimmed : null;
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

        const jwtPayload = parseJwtPayload(activeToken);
        const emailFromJwt = getStringClaim(jwtPayload, ["email", "preferred_username", "username", "sub"]);

        // Some legacy /users/me responses omit email; keep the login email so
        // admin allowlist + UI don't break.
        const loginEmail = getPersistedLoginEmail();
        const merged: UserProfile = {
          ...profile,
          email:
            typeof profile?.email === "string" && profile.email.trim().length > 0
              ? profile.email
              : loginEmail ?? emailFromJwt ?? (profile?.email as any),
        };

        // If env allowlist marks this email as admin, reflect it in the user object
        // even when backend doesn't return is_admin.
        if (merged.is_admin !== true) {
          if (hasAdminClaim(jwtPayload) || isAdminUserEmail(merged.email) || (await probeAdminAccess(activeToken))) {
            merged.is_admin = true;
          }
        }

        // Keep the latest known email persisted for future sessions.
        persistLoginEmail(merged.email);

        setUser(merged);
        return merged;
      } catch (error) {
        console.error("Failed to refresh profile", error);
        persistToken(null);
        setToken(null);
        setUser(null);
        return null;
      }
    },
    [token, persistToken, getPersistedLoginEmail, persistLoginEmail],
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
        persistLoginEmail(email);
        const result = await loginRequest(email, password);
        persistToken(result.access_token);
        setToken(result.access_token);
        await refreshProfile(result.access_token);
      } finally {
        setLoading(false);
      }
    },
    [persistToken, refreshProfile, persistLoginEmail],
  );

  const logout = useCallback(() => {
    persistToken(null);
    persistLoginEmail(null);
    setToken(null);
    setUser(null);
  }, [persistToken, persistLoginEmail]);

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
