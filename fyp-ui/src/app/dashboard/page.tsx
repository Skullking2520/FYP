"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getDashboardEntryPath } from "@/lib/resume";

export default function DashboardPage() {
  const router = useRouter();
  const { token, loading } = useAuth();

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (loading) return;
    if (!token) return;
    router.replace(getDashboardEntryPath());
  }, [loading, token, router]);

  return <div className="p-6 text-sm text-slate-500">Redirecting…</div>;
}
