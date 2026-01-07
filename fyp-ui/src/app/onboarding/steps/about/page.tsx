"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOnboarding } from "../../_components/OnboardingProvider";
import { Progress } from "../../_components/Progress";
import { StepNav } from "../../_components/StepNav";
import { useAuth } from "@/components/auth-provider";
import { extractSkillsFromText, searchJobs } from "@/lib/backend-api";
import type { SkillReference } from "@/types/api";

export default function AboutStep() {
  const { data, setData } = useOnboarding();
  const { token } = useAuth();

  const [hobbies, setHobbies] = useState<string>(data.about.hobbies);
  const [selfIntro, setSelfIntro] = useState<string>(data.about.selfIntro);

  const [extractedSkills, setExtractedSkills] = useState<SkillReference[]>(() =>
    Array.isArray(data.about.extractedSkills)
      ? (data.about.extractedSkills as unknown[])
          .filter(
            (v): v is SkillReference =>
              !!v &&
              typeof v === "object" &&
              typeof (v as any).skill_name === "string" &&
              ((v as any).skill_id === undefined || (v as any).skill_id === null || typeof (v as any).skill_id === "string"),
          )
          .map((v) => ({ skill_name: String(v.skill_name), skill_id: (v as any).skill_id ?? null }))
      : [],
  );

  const [target, setTarget] = useState<string>("");
  const [targetJob, setTargetJob] = useState<string>(data.career.targetJobs[0] ?? "");
  const [notes, setNotes] = useState<string>(data.career.notes);

  const [jobSuggestions, setJobSuggestions] = useState<string[]>([]);
  const [jobSuggestionsLoading, setJobSuggestionsLoading] = useState(false);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const combinedText = useMemo(() => {
    const parts = [
      hobbies.trim() ? `Hobbies:\n${hobbies.trim()}` : "",
      selfIntro.trim() ? `Self-introduction:\n${selfIntro.trim()}` : "",
      notes.trim() ? `Notes:\n${notes.trim()}` : "",
    ].filter(Boolean);
    return parts.join("\n\n");
  }, [hobbies, selfIntro, notes]);

  const runExtraction = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        if (mountedRef.current) setExtractedSkills([]);
        setData("about", { hobbies, selfIntro, extractedSkills: [] });
        if (mountedRef.current) {
          setExtracting(false);
          setExtractError(null);
        }
        return;
      }

      try {
        if (mountedRef.current) {
          setExtracting(true);
          setExtractError(null);
        }

        const res = await extractSkillsFromText(trimmed, token);
        const next = Array.isArray(res?.skills)
          ? res.skills
              .filter((s) => typeof s?.skill_name === "string" && s.skill_name.trim().length > 0)
              .slice(0, 25)
              .map((s) => ({ skill_name: s.skill_name.trim(), skill_id: s.skill_id ?? null }))
          : [];

        if (mountedRef.current) setExtractedSkills(next);
        setData("about", { hobbies, selfIntro, extractedSkills: next });
        if (mountedRef.current) {
          setExtracting(false);
          setExtractError(null);
        }
      } catch {
        if (mountedRef.current) {
          setExtracting(false);
          setExtractError("Skill extraction failed");
        }
      }
    },
    [hobbies, selfIntro, setData, token],
  );

  useEffect(() => {
    setData("about", { hobbies, selfIntro, extractedSkills });
    setData("career", { targetJobs: targetJob.trim() ? [targetJob.trim()] : [], notes });
  }, [hobbies, selfIntro, extractedSkills, targetJob, notes, setData]);

  useEffect(() => {
    // Debounced extraction while typing.
    const handle = window.setTimeout(() => {
      void runExtraction(combinedText);
    }, 500);
    return () => window.clearTimeout(handle);
  }, [combinedText, runExtraction]);

  const addTarget = (t: string) => {
    const v = t.trim();
    if (!v) return;
    // Single selection: new value replaces the previous one.
    setTargetJob(v);
  };
  const clearTarget = () => setTargetJob("");

  useEffect(() => {
    const q = target.trim();
    let cancelled = false;
    const handle = window.setTimeout(() => {
      if (cancelled) return;

      if (q.length < 2) {
        setJobSuggestions([]);
        setJobSuggestionsLoading(false);
        return;
      }

      setJobSuggestionsLoading(true);
      searchJobs(q, 20)
        .then((items) => {
          if (cancelled) return;
          const titles = Array.isArray(items)
            ? items
                .map((j) => (typeof j?.title === "string" ? j.title.trim() : ""))
                .filter((t) => t.length > 0)
            : [];
          setJobSuggestions(Array.from(new Set(titles)).slice(0, 8));
        })
        .catch(() => {
          if (cancelled) return;
          setJobSuggestions([]);
        })
        .finally(() => {
          if (cancelled) return;
          setJobSuggestionsLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [target]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Hobbies & Self-introduction</h1>
      <Progress index={2} />

      <div className="rounded-2xl bg-white border shadow-sm p-5 space-y-4">
        <div>
          <div className="text-sm font-medium mb-2">Future job (optional, choose one)</div>
          <div className="space-y-2">
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Search a job title (e.g., Data Scientist)"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />

            {jobSuggestionsLoading && (
              <div className="text-xs text-slate-500 px-1">Searching…</div>
            )}

            {jobSuggestions.length > 0 && (
              <div className="rounded-xl border bg-white overflow-hidden">
                {jobSuggestions.map((title) => (
                  <button
                    key={title}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-slate-50"
                    onMouseDown={(e) => {
                      // Prevent input blur from killing the click.
                      e.preventDefault();
                      addTarget(title);
                      setTarget("");
                    }}
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {targetJob && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-xl border bg-slate-50">
                {targetJob} <button type="button" className="ml-1 text-slate-500" onClick={clearTarget}>×</button>
              </span>
            </div>
          )}

          <div className="mt-3 text-xs text-slate-600">
            Skill extraction: {extracting ? "Extracting…" : `${extractedSkills.length} skills`}
            {extractError ? <span className="text-red-700"> · {extractError}</span> : null}
          </div>
        </div>

        <textarea
          className="w-full rounded-xl border px-3 py-2 min-h-[90px]"
          placeholder="Hobbies (optional)\nExample: basketball, reading, coding projects"
          value={hobbies}
          onChange={(e) => setHobbies(e.target.value)}
        />
        <textarea
          className="w-full rounded-xl border px-3 py-2 min-h-[120px]"
          placeholder="Short self-introduction (optional)\nExample: I'm interested in tech and enjoy building small apps..."
          value={selfIntro}
          onChange={(e) => setSelfIntro(e.target.value)}
        />

        <textarea
          className="w-full rounded-xl border px-3 py-2 min-h-[90px]"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <StepNav
        prev="/onboarding/steps/academics"
        next="/onboarding/steps/skills"
        canNext
        onNext={() => {
          // Best-effort: ensure the latest text is extracted before entering Skills.
          void runExtraction(combinedText);
        }}
      />
    </div>
  );
}
