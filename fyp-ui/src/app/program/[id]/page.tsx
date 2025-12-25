import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgramUniversityTable } from "@/components/program-university-table";
import { SkillResourceCard } from "@/components/skill-resource-card";
import { getResourcesForSkills } from "@/data/resources";
import { fetchProgramDetail, fetchProgramUniversities } from "@/lib/api";
import type { ProgramId } from "@/types";

type Params = { id: ProgramId };

export default async function ProgramDetail({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  if (!id) notFound();

  const program = await fetchProgramDetail(id);
  if (!program) notFound();

  const universities = await fetchProgramUniversities(program.id);
  const resources = getResourcesForSkills(program.tags);

  return (
    <div className="space-y-8 p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Program</p>
            <h1 className="text-3xl font-semibold text-slate-900">{program.name}</h1>
            <p className="mt-2 text-sm text-slate-600">{program.description}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/recommendations" className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-900">
              Back to recommendations
            </Link>
            {universities.length > 0 ? (
              <Link
                href={`/program/${program.id}/uni/${universities[0].uniId}`}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Explore universities
              </Link>
            ) : (
              <span className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
                Universities coming soon
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {program.tags.map((tag) => (
            <span key={tag} className="rounded-full border px-3 py-1 text-xs font-semibold uppercase text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Focus areas</h2>
          <p className="text-sm text-slate-600">Skills and experiences emphasized across the curriculum.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {program.focusAreas.map((area) => (
            <span key={area} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              {area}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Universities offering this program</h2>
          <p className="text-sm text-slate-600">Compare entry requirements, study styles, and ranks.</p>
        </div>
        <ProgramUniversityTable programId={program.id} universities={universities} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Suggested learning resources</h2>
          <p className="text-sm text-slate-600">Fill gaps aligned with this program&apos;s tags.</p>
        </div>
        {resources.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white/60 p-5 text-sm text-slate-500">
            No curated resources yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <SkillResourceCard key={`${resource.skill}-${resource.title}`} resource={resource} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
