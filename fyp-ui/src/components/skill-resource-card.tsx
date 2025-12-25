import type { SkillResource } from "@/types";

type SkillResourceCardProps = {
  resource: SkillResource;
};

export function SkillResourceCard({ resource }: SkillResourceCardProps) {
  const url = (resource.url ?? "").trim();
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{resource.skill}</div>
      <div className="mt-1 text-base font-semibold text-slate-900">{resource.title}</div>
      <div className="text-sm text-slate-500">{resource.provider}</div>

      {resource.guidance_text ? (
        <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{resource.guidance_text}</div>
      ) : null}

      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-blue-600">
          Open resource
        </a>
      ) : null}
    </div>
  );
}
