"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { registerRequest } from "@/lib/api";
import { getPostAuthRedirectPath } from "@/lib/resume";

export default function RegisterPage() {
  const router = useRouter();
  const { token, loading, login } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (!loading && token) {
      router.replace(getPostAuthRedirectPath());
    }
  }, [loading, token, router]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await registerRequest({
        email: form.email,
        password: form.password,
        name: form.name || undefined,
      });
      await login(form.email, form.password);
      router.push(getPostAuthRedirectPath());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white border shadow-sm p-6 space-y-5">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Join CareerPath.AI</p>
          <h1 className="text-2xl font-semibold">Create an account</h1>
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <label className="text-sm">
            <span className="text-slate-600">Full name</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Junsoo Hyun"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Email</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Password</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
            />
          </label>
          <button className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>
        <div className="text-sm text-slate-500">
          Already registered? <Link className="underline" href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
