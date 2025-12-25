import Link from "next/link";
import type { ProgramId, UniversityProgram } from "@/types";

type ProgramUniversityTableProps = {
  programId: ProgramId;
  universities: UniversityProgram[];
};

export function ProgramUniversityTable({ programId, universities }: ProgramUniversityTableProps) {
  if (universities.length === 0) {
    return <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500">No university data yet.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">University</th>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Required skills</th>
            <th className="px-4 py-3">Entry requirements</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {universities.map((uni) => (
            <tr key={uni.uniId} className="border-t">
              <td className="px-4 py-4">
                <div className="font-medium text-slate-900">{uni.uniName}</div>
                <div className="text-xs text-slate-500 capitalize">{uni.region}</div>
              </td>
              <td className="px-4 py-4 text-slate-600">{uni.rank ? `#${uni.rank}` : "—"}</td>
              <td className="px-4 py-4 text-slate-600">
                <ul className="list-disc pl-4">
                  {uni.requiredSkills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </td>
              <td className="px-4 py-4 text-slate-600">
                <ul className="list-disc pl-4">
                  {uni.entryRequirements.map((req) => (
                    <li key={req}>{req}</li>
                  ))}
                </ul>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={`/program/${programId}/uni/${uni.uniId}`}
                    className="rounded-xl border px-3 py-1 text-xs font-medium"
                  >
                    Gap analysis
                  </Link>
                  <a
                    href={uni.programUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-blue-600"
                  >
                    Visit site
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
