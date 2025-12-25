"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AdminTable } from "@/components/admin/AdminTable";
import { PROGRAMS } from "@/data/programs";
import { isAdminUser } from "@/lib/admin";
import type { Program } from "@/types";

export default function AdminProgramsPage() {
  const router = useRouter();
  const { token, user, loading } = useAuth();
  const isAdmin = isAdminUser(user);
  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    const lower = query.toLowerCase();
    return PROGRAMS.filter((program) => program.name.toLowerCase().includes(lower) || program.id.toLowerCase().includes(lower));
  }, [query]);

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

  if (!token || !isAdmin) {
    return null;
  }

  const columns = [
    {
      header: "Program",
      render: (program: Program) => (
        <div>
          <div className="font-semibold text-slate-900">{program.name}</div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{program.id}</div>
        </div>
      ),
    },
    {
      header: "Difficulty",
      render: (program: Program) => <span className="capitalize text-slate-700">{program.difficulty}</span>,
    },
    {
      header: "Study style",
      render: (program: Program) => <span className="capitalize text-slate-700">{program.studyStyle}</span>,
    },
    {
      header: "Tags",
      render: (program: Program) => (
        <div className="flex flex-wrap gap-1">
          {program.tags.map((tag) => (
            <span key={tag} className="rounded-full border px-2 py-0.5 text-xs text-slate-500">
              {tag}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      render: () => (
        <div className="flex justify-end gap-2">
          <button className="rounded-lg border px-3 py-1 text-xs font-semibold text-slate-600" disabled>
            Edit
          </button>
          <button className="rounded-lg border px-3 py-1 text-xs font-semibold text-slate-600" disabled>
            Add modules
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Programs admin</h1>
          <p className="text-sm text-slate-600">Manage catalog entries before syncing with the backend.</p>
        </div>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled>
          Add program
        </button>
      </div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or id"
          className="w-full rounded-xl border px-4 py-2 text-sm"
        />
      </div>
      <AdminTable<Program> columns={columns} data={data} emptyLabel="No programs match" />
    </div>
  );
}
