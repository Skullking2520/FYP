"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Checking your session...</div>;
  }

  if (!user) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Please sign in</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to view your profile.</p>
          <Link href="/login" className="mt-4 inline-flex rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Your profile</p>
            <h1 className="text-3xl font-semibold text-slate-900">{user.name || user.email}</h1>
            <p className="mt-2 text-sm text-slate-600">Email: {user.email}</p>
          </div>
          <Link href="/dashboard" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-900">
            Edit in dashboard
          </Link>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Interests</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{user.interests_text ?? "—"}</p>
        <h2 className="pt-3 text-lg font-semibold text-slate-900">Skills</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{user.skills_text ?? "—"}</p>
      </section>
    </div>
  );
}
