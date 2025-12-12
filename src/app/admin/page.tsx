"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { isAdminUserEmail } from "@/lib/admin";

export default function AdminPage() {
  const router = useRouter();
  const { token, user, loading } = useAuth();
  const isAdmin = isAdminUserEmail(user?.email);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
    }
  }, [loading, token, isAdmin, router]);

  if (!token || !isAdmin) {
    return null;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin Console</h1>
      <p className="text-sm text-slate-600">Only admin can see this page.</p>
      <div className="rounded-2xl bg-white border shadow-sm p-4">
        <div className="text-sm">• Manage users (coming soon)</div>
        <div className="text-sm">• Sync skills/program data (coming soon)</div>
        <div className="text-sm">• Tuning recommendation weights (coming soon)</div>
      </div>
    </div>
  );
}
