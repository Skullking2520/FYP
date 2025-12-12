"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { extractSkills, updateProfile } from "@/lib/api";

type FormState = {
  name: string;
  age: string;
  country: string;
  interests_text: string;
  skills_text: string;
};

const emptyForm: FormState = {
  name: "",
  age: "",
  country: "",
  interests_text: "",
  skills_text: "",
};

export default function DashboardPage() {
  const router = useRouter();
  const { token, user, loading, refreshProfile, logout } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
        age: user.age ? String(user.age) : "",
        country: user.country ?? "",
        interests_text: user.interests_text ?? "",
        skills_text: user.skills_text ?? "",
      });
    }
  }, [user]);

  const completion = useMemo(() => {
    const filled = Object.values(form).filter((value) => value.trim().length > 0).length;
    return Math.round((filled / Object.keys(form).length) * 100);
  }, [form]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      await updateProfile(token, {
        name: form.name || null,
        age: form.age ? Number(form.age) : null,
        country: form.country || null,
        interests_text: form.interests_text || null,
        skills_text: form.skills_text || null,
      });
      await refreshProfile();
      setStatus("Profile updated successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleExtractSkills = async () => {
    if (!token) {
      return;
    }
    const source = `${form.interests_text}\n${form.skills_text}`.trim();
    if (!source) {
      setError("Please add some text about your interests or skills first.");
      return;
    }
    setError(null);
    setStatus(null);
    setExtracting(true);
    try {
      const response = await extractSkills(source, token);
      const uniqueSkills = Array.from(new Set(response.skills.map((skill) => skill.skill_name).filter(Boolean)));
      setForm((prev) => ({ ...prev, skills_text: uniqueSkills.join(", ") }));
      setStatus("Skills extracted from your text");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to extract skills";
      setError(message);
    } finally {
      setExtracting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Checking your session...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500">Welcome back</p>
          <h1 className="text-2xl font-semibold">{user?.name || user?.email || "Your dashboard"}</h1>
        </div>
        <div className="flex gap-3">
          <button
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            onClick={() => router.push("/recommendations")}
            disabled={!token}
          >
            View recommendations
          </button>
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Profile & interests</h2>
              <p className="text-sm text-slate-500">Describe what you enjoy learning or working on.</p>
            </div>
            <span className="text-sm text-slate-500">{completion}% complete</span>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-600">
                Full name
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Junsoo Hyun"
                />
              </label>
              <label className="text-sm text-slate-600">
                Country
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  placeholder="Malaysia"
                />
              </label>
            </div>
            <label className="text-sm text-slate-600">
              Age
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                name="age"
                type="number"
                min={13}
                max={99}
                value={form.age}
                onChange={handleChange}
              />
            </label>
            <label className="text-sm text-slate-600">
              Interests (free text)
              <textarea
                className="mt-1 w-full rounded-2xl border px-3 py-2"
                name="interests_text"
                rows={4}
                placeholder="I enjoy AI, robotics, building indie games..."
                value={form.interests_text}
                onChange={handleChange}
              />
            </label>
            <label className="text-sm text-slate-600">
              Skills (comma separated)
              <textarea
                className="mt-1 w-full rounded-2xl border px-3 py-2"
                name="skills_text"
                rows={4}
                placeholder="Python, machine learning, Unity, Arduino"
                value={form.skills_text}
                onChange={handleChange}
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {status && <p className="text-sm text-green-600">{status}</p>}
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm"
                onClick={handleExtractSkills}
                disabled={extracting}
              >
                {extracting ? "Extracting..." : "Auto-extract skills"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Next steps</h2>
            <p className="text-sm text-slate-500">When you are ready, request fresh recommendations.</p>
          </div>
          <div className="rounded-xl border border-dashed p-4 text-sm text-slate-600">
            <p>Use natural language to describe your projects or goals. The extractor will detect keywords from ONET/ESCO data.</p>
          </div>
          <button
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-white"
            onClick={() => router.push("/recommendations")}
            disabled={!user}
          >
            Get recommendations
          </button>
        </section>
      </div>
    </div>
  );
}
