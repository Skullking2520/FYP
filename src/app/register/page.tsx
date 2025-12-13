"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { registerRequest } from "@/lib/api";
import { COUNTRY_OPTIONS } from "@/lib/countries";

export default function RegisterPage() {
  const router = useRouter();
  const { token, loading, login } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    age: "",
    country: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const envMissing = !apiBaseUrl;

  useEffect(() => {
    if (!loading && token) {
      router.replace("/dashboard");
    }
  }, [loading, token, router]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (envMissing) {
      setSubmitting(false);
      setError("NEXT_PUBLIC_API_BASE_URL is not set. Add it to your environment (see .env.example). Then restart `npm run dev`.");
      return;
    }

    try {
      await registerRequest({
        email: form.email,
        password: form.password,
        name: form.name || undefined,
        age: form.age ? Number(form.age) : undefined,
        country: form.country || undefined,
      });
      await login(form.email, form.password);
      router.push("/dashboard");
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

        {envMissing && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-semibold">Backend URL not configured</div>
            <div className="mt-1 text-amber-800">
              Set <span className="font-mono">NEXT_PUBLIC_API_BASE_URL</span> in <span className="font-mono">.env.local</span> (copy from <span className="font-mono">.env.example</span>), then restart the dev server.
            </div>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-slate-600">Age</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                type="number"
                name="age"
                min={13}
                max={99}
                value={form.age}
                onChange={handleChange}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Country</span>
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2"
                name="country"
                value={form.country}
                onChange={handleSelectChange}
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option || "__empty"} value={option}>
                    {option ? option : "Select a country"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={submitting || envMissing}>
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
