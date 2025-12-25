"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login, token, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && token) {
      const done = typeof window === "undefined" ? null : window.localStorage.getItem("onboarding_completed_v1");
      router.replace(done ? "/dashboard" : "/onboarding/steps/basic");
    }
  }, [loading, token, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    setSubmitting(true);
    try {
      await login(email, password);
      const done = typeof window === "undefined" ? null : window.localStorage.getItem("onboarding_completed_v1");
      router.push(done ? "/dashboard" : "/onboarding/steps/basic");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white border shadow-sm p-6 space-y-5">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Welcome back</p>
          <h1 className="text-2xl font-semibold">Sign in to continue</h1>
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="text-slate-600">Email</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Password</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button
            className="w-full rounded-xl bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <div className="text-sm text-slate-500">
          New here? <Link className="underline" href="/register">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
