"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { isAdminUser } from "@/lib/admin";
import { registerRequest } from "@/lib/api";

export default function AdminCreateAdminAccountPage() {
  const router = useRouter();
  const { token, user, loading } = useAuth();
  const isAdmin = isAdminUser(user);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
    }
  }, [loading, token, isAdmin, router]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setStatus(null);

    try {
      await registerRequest({
        email: form.email,
        password: form.password,
        name: form.name || undefined,
      });

      setStatus("Account created. Add this email to backend ADMIN_EMAILS to grant admin access.");
      setForm({ name: "", email: "", password: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-lg space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Admin only</p>
            <h1 className="text-2xl font-semibold">Create account for admin</h1>
            <p className="mt-2 text-sm text-slate-600">
              This page creates a normal account. Admin access is granted by adding the email to backend ADMIN_EMAILS.
            </p>
          </div>
          <Link className="text-sm text-slate-700 hover:underline" href="/admin">
            ← Back
          </Link>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Note: Do not add an &quot;admin&quot; checkbox to signup. Use backend ADMIN_EMAILS allowlist for admin access.
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}
        {status && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">{status}</div>
        )}

        <form className="grid gap-3" onSubmit={handleSubmit}>
          <label className="text-sm">
            <span className="text-slate-600">Full name</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Admin User"
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

          <button
            className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? "Creating..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
