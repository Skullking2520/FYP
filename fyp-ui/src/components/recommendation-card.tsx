import Link from "next/link";
import type { ProgramRecommendation } from "@/types";

type RecommendationCardProps = {
  data: ProgramRecommendation;
};

export function RecommendationCard({ data }: RecommendationCardProps) {
  return (
    <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{data.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{data.description}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold text-slate-900">{Math.round(data.matchScore * 100)}%</div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Match score</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.tags.map((tag) => (
          <span key={tag} className="rounded-full border px-3 py-1 text-xs font-semibold uppercase text-slate-600">
            {tag}
          </span>
        ))}
      </div>
      {data.reasonTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.reasonTags.map((reason) => (
            <span key={reason} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {reason}
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Link href={`/program/${data.id}`} className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-900">
          View program
        </Link>
      </div>
    </div>
  );
}
