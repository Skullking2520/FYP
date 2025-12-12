"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { useAuth } from "@/components/auth-provider";
import { getProgramById } from "@/data/programs";
import { PROGRAM_UNIS } from "@/data/universities";
import { isAdminUserEmail } from "@/lib/admin";
import type { ProgramId, UniversityProgram } from "@/types";

type Row = {
  programId: ProgramId;
  university: UniversityProgram;
};

export default function AdminUniversitiesPage() {
  const router = useRouter();
  const { token, user, loading } = useAuth();
  const isAdmin = isAdminUserEmail(user?.email);
  const [query, setQuery] = useState("");

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

  const rows = useMemo<Row[]>(() => {
    return Object.entries(PROGRAM_UNIS).flatMap(([programId, unis]) =>
      unis.map((uni) => ({ programId, university: uni })),
    );
  }, []);

  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return rows.filter((row) =>
      row.university.uniName.toLowerCase().includes(lower) || row.programId.toLowerCase().includes(lower),
    );
  }, [rows, query]);

  const columns = [
    {
      header: "Program",
      render: (row: Row) => {
        const program = getProgramById(row.programId);
        return (
          <div>
            <div className="font-semibold text-slate-900">{program?.name ?? row.programId}</div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{row.programId}</div>
          </div>
        );
      },
    },
    {
      header: "University",
      render: (row: Row) => (
        <div>
          <div className="font-medium text-slate-900">{row.university.uniName}</div>
          <div className="text-xs text-slate-500 capitalize">{row.university.region}</div>
        </div>
      ),
    },
    {
      header: "Rank",
      render: (row: Row) => <span className="text-slate-600">{row.university.rank ? `#${row.university.rank}` : "—"}</span>,
    },
    {
      header: "Required skills",
      render: (row: Row) => <span className="text-slate-600">{row.university.requiredSkills.length}</span>,
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
            Add entry
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Universities admin</h1>
          <p className="text-sm text-slate-600">Curate program-university mappings.</p>
        </div>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled>
          Add university
        </button>
      </div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by university or program"
          className="w-full rounded-xl border px-4 py-2 text-sm"
        />
      </div>
      <AdminTable<Row> columns={columns} data={filtered} emptyLabel="No records" />
    </div>
  );
}
