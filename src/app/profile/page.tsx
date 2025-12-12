"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RecommendationCard } from "@/components/recommendation-card";
import { fetchRecommendedPrograms } from "@/lib/api";
import { loadStoredProfile } from "@/lib/profile-storage";
import type { ProgramRecommendation, UserProfile } from "@/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [programs, setPrograms] = useState<ProgramRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(loadStoredProfile());
  }, []);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    fetchRecommendedPrograms(profile)
      .then((data) => setPrograms(data.slice(0, 3)))
      .catch(() => setError("Failed to load recommendations"))
      .finally(() => setLoading(false));
  }, [profile]);

  if (!profile) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">No profile yet</h1>
          <p className="mt-2 text-sm text-slate-600">Complete onboarding to see your personalized dashboard.</p>
          <a href="/onboarding/steps/basic" className="mt-4 inline-flex rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
            Start onboarding
          </a>
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
            <h1 className="text-3xl font-semibold text-slate-900">{profile.interests.join(", ") || "Generalist"}</h1>
            <p className="mt-2 text-sm text-slate-600">
              Math level {profile.mathLevel ?? "n/a"} · CS taken {profile.csTaken ? "yes" : "no"} · Study style {profile.studyStyle ?? "not set"}
            </p>
          </div>
          <Link href="/recommendations" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-900">
            View all recommendations
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Last recommended programs</h2>
            <p className="text-sm text-slate-600">Top matches based on your latest onboarding data.</p>
          </div>
          {loading && <span className="text-xs uppercase tracking-wide text-slate-500">Loading...</span>}
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {programs.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed bg-white/60 p-6 text-sm text-slate-500">
            No recommendations yet. Run the recommender to populate this section.
          </div>
        ) : (
          <div className="grid gap-4">
            {programs.map((program) => (
              <RecommendationCard key={program.id} data={program} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Saved programs</h2>
            <p className="text-sm text-slate-600">Bookmark favorites to revisit later. Coming soon.</p>
          </div>
          <button className="rounded-xl border px-4 py-2 text-sm text-slate-400" disabled>
            Add program
          </button>
        </div>
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
          Save interesting programs from recommendations to build your shortlist. This feature will sync once backend is ready.
        </div>
      </section>
    </div>
  );
}
