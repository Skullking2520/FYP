"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getJobMajors, getMajorPrograms } from "@/lib/backend-api";
import { useAuth } from "@/components/auth-provider";
import { updateProfile } from "@/lib/api";
import { clearSelectedMajor, loadSelectedJob, saveSelectedMajor } from "@/lib/pathway-storage";
import { buildLocalProfileUpdatePayload } from "@/lib/resume";
import type { BackendMajorProgramRanking, BackendMajorRecommendation } from "@/types/api";

function formatScore(score: unknown): string {
  if (typeof score === "number" && Number.isFinite(score)) return score.toFixed(3);
  if (typeof score === "string" && score.trim()) {
    const parsed = Number(score);
    if (Number.isFinite(parsed)) return parsed.toFixed(3);
    return score;
  }
  return "N/A";
}

export default function PathwayMajorsPage() {
  const router = useRouter();
  const { token } = useAuth();

  const initialJob = typeof window === "undefined" ? null : loadSelectedJob();
  const [jobId] = useState<string | null>(() => initialJob?.job_id ?? null);
  const [jobTitle] = useState<string | undefined>(() => initialJob?.title);

  const [majors, setMajors] = useState<BackendMajorRecommendation[]>([]);
  const [programsByMajor, setProgramsByMajor] = useState<Record<string, BackendMajorProgramRanking[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearSelectedMajor();
  }, []);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setMajors([]);
    });

    getJobMajors(jobId, 5)
      .then((data) => {
        if (cancelled) return;
        const nextMajors = Array.isArray(data) ? data : [];
        setMajors(nextMajors);

        // Fetch a small program ranking preview for each major.
        return Promise.all(
          nextMajors.slice(0, 5).map(async (m) => {
            const majorId = String(m.major_id);
            try {
              const programs = await getMajorPrograms(majorId, 3);
              return { majorId, programs: Array.isArray(programs) ? programs : [] };
            } catch {
              return { majorId, programs: [] as BackendMajorProgramRanking[] };
            }
          }),
        );
      })
      .then((pairs) => {
        if (cancelled) return;
        if (!pairs) return;
        const map: Record<string, BackendMajorProgramRanking[]> = {};
        for (const p of pairs) {
          map[p.majorId] = p.programs;
        }
        setProgramsByMajor(map);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load major recommendations";
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (!jobId) {
    return (
      <div className="space-y-6 p-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-slate-500">Step 2</p>
          <h1 className="text-2xl font-semibold text-slate-900">Select a major</h1>
        </header>
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-700">No job selected yet.</div>
          <p className="mt-2 text-sm text-slate-600">Go back and choose a job first.</p>
          <div className="mt-4">
            <Link href="/pathway/jobs" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Go to job selection
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Step 2</p>
            <h1 className="text-2xl font-semibold text-slate-900">Select a major</h1>
            <p className="mt-2 text-sm text-slate-600">Recommended majors (with ranking previews) for your selected job.</p>
            <p className="mt-1 text-sm text-slate-500">Job: {jobTitle ?? jobId}</p>
          </div>
          <Link href="/pathway/jobs" className="text-sm text-slate-700 hover:underline">
            ← Back to jobs
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Recommended majors (Top 5)</h2>

        {loading && <div className="mt-4 text-sm text-slate-500">Loading major recommendations…</div>}

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        {!loading && !error && majors.length === 0 && (
          <div className="mt-4 text-sm text-slate-500">No major recommendations available</div>
        )}

        {!loading && !error && majors.length > 0 && (
          <ul className="mt-4 space-y-3">
            {majors.slice(0, 5).map((major) => {
              const majorId = String(major.major_id);
              const preview = programsByMajor[majorId] ?? [];
              return (
                <li key={majorId} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{major.major_name}</div>
                      <div className="text-sm text-slate-600">
                        Matched: {major.matched_skills ?? 0} · Score: {formatScore(major.score)}
                      </div>

                      {preview.length > 0 && (
                        <div className="mt-3 rounded-xl border bg-slate-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ranking preview</div>
                          <ul className="mt-2 space-y-1 text-sm text-slate-700">
                            {preview.map((p) => (
                              <li key={String(p.program_id)} className="flex flex-wrap gap-x-2">
                                <span className="font-medium text-slate-900">{p.university_name}</span>
                                <span className="text-slate-600">· {p.program_name}</span>
                                <span className="text-slate-500">
                                  · {typeof p.rank_position === "number" ? `#${p.rank_position}` : p.rank_band ?? "—"}
                                </span>
                                <span className="text-slate-500">· {p.ranking_source ?? "—"}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <button
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      onClick={() => {
                        saveSelectedMajor({ major_id: majorId, major_name: major.major_name });
                        if (token) {
                          const payload = buildLocalProfileUpdatePayload();
                          void updateProfile(token, payload).catch((err) => {
                            console.warn("Failed to persist profile", err);
                          });
                        }
                        router.push("/pathway/plan");
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
