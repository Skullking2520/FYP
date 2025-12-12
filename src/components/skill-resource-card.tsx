import type { SkillResource } from "@/types";

type SkillResourceCardProps = {
  resource: SkillResource;
};

export function SkillResourceCard({ resource }: SkillResourceCardProps) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{resource.skill}</div>
      <div className="mt-1 text-base font-semibold text-slate-900">{resource.title}</div>
      <div className="text-sm text-slate-500">{resource.provider}</div>
      <a href={resource.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-blue-600">
        Open resource
      </a>
    </div>
  );
}
