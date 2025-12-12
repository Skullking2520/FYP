"use client";
import { useEffect, useState } from "react";
import { useOnboarding } from "../../_components/OnboardingProvider";
import { Progress } from "../../_components/Progress";
import { useRouter } from "next/navigation";
import { buildUserProfile, suggestJobsBySkills } from "@/lib/match";
import { saveProfileToLocal } from "@/lib/profile-storage";

export default function CareerStep() {
  const { data, setData } = useOnboarding();
  const [target, setTarget] = useState<string>("");
  const [targetJobs, setTargetJobs] = useState<string[]>(data.career.targetJobs);
  const [notes, setNotes] = useState<string>(data.career.notes);
  const [noIdea, setNoIdea] = useState<boolean>(false);
  const [suggested, setSuggested] = useState<{id:string;title:string;reason:string[]}[]>([]);
  const router = useRouter();

  useEffect(() => {
    setData("career", { targetJobs, notes });
  }, [targetJobs, notes, setData]);

  const persistProfile = () => {
    try {
      const profile = buildUserProfile(data);
      saveProfileToLocal(profile);
    } catch {}
  };

  const addTarget = (t: string) => {
    const v = t.trim();
    if (!v) return;
    setTargetJobs(prev => Array.from(new Set([...prev, v])));
  };
  const removeTarget = (t: string) => setTargetJobs(prev => prev.filter(x => x !== t));

  const handleNoIdea = () => {
    setNoIdea(true);
    try {
      const raw = JSON.parse(localStorage.getItem("onboardingData") || "{}");
      const prof = buildUserProfile(raw);
      setSuggested(suggestJobsBySkills(prof));
    } catch {
      setSuggested([]);
    }
  };

  const acceptSuggested = (_jobId: string, title: string) => {
    setTargetJobs([title]);
    persistProfile();
    router.push("/recommendations");
  };

  const finish = () => {
    persistProfile();
    router.push("/recommendations");
  };
  const canFinish = targetJobs.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Career Goals</h1>
      <Progress index={3} />

      <div className="rounded-2xl bg-white border shadow-sm p-5 space-y-4">
        {!noIdea && (
          <>
            <div className="flex gap-2">
              <input className="flex-1 rounded-xl border px-3 py-2"
                     placeholder="Add target job e.g., Data Scientist"
                     value={target}
                     onChange={(e)=>setTarget(e.target.value)} />
              <button className="px-4 py-2 rounded-xl border" onClick={()=>{ addTarget(target); setTarget(""); }}>
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {targetJobs.map((t)=>(
                <span key={t} className="px-3 py-1 rounded-xl border bg-slate-50">
                  {t} <button className="ml-1 text-slate-500" onClick={()=>removeTarget(t)}>×</button>
                </span>
              ))}
            </div>

            <button className="px-4 py-2 rounded-xl border" onClick={handleNoIdea}>
                I don&apos;t know yet (Recommend jobs from my skills)
            </button>
          </>
        )}

        {noIdea && (
          <div>
            <div className="text-sm font-medium mb-2">Suggested Jobs</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {suggested.map(s => (
                <div key={s.id} className="rounded-xl border p-3">
                  <div className="font-medium">{s.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{s.reason.join(" · ")}</div>
                  <button className="mt-3 px-3 py-2 rounded-xl bg-blue-600 text-white"
                          onClick={()=>acceptSuggested(s.id, s.title)}>
                    Choose this
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <textarea
          className="w-full rounded-xl border px-3 py-2 min-h-[100px]"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e)=>setNotes(e.target.value)}
        />
      </div>

      <div className="mt-6 flex gap-3">
        <a className="px-4 py-2 rounded-xl border" href="/onboarding/steps/academics">Back</a>
        <button
          disabled={!canFinish}
          className={`px-4 py-2 rounded-xl text-white ${canFinish ? "bg-green-600" : "bg-slate-400 cursor-not-allowed"}`}
          onClick={finish}
        >
          Finish & Get Recommendations
        </button>
      </div>
    </div>
  );
}
