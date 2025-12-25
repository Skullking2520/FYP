type GapAnalysisCardProps = {
  missing: string[];
  covered: string[];
};

export function GapAnalysisCard({ missing, covered }: GapAnalysisCardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Covered skills</div>
        {covered.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No overlapping skills detected yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-emerald-700">
            {covered.map((skill) => (
              <li key={skill} className="rounded-xl bg-emerald-50 px-3 py-2">
                {skill}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Gaps to focus</div>
        {missing.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">You already cover every requirement.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-red-700">
            {missing.map((skill) => (
              <li key={skill} className="rounded-xl bg-red-50 px-3 py-2">
                {skill}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
