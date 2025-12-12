"use client";
import { useState } from "react";
import { useOnboarding } from "../../_components/OnboardingProvider";
import { Progress } from "../../_components/Progress";
import { StepNav } from "../../_components/StepNav";

export default function BasicStep() {
  const { data, setData } = useOnboarding();
  const [fullName, setFullName] = useState(data.basic.fullName);
  const [country, setCountry] = useState(data.basic.country);
  const [age, setAge] = useState<string>(data.basic.age ? String(data.basic.age) : "");

  const handleFullName = (v: string) => {
    setFullName(v);
    setData("basic", { ...data.basic, fullName: v, country, age: age ? Number(age) : null });
  };
  const handleCountry = (v: string) => {
    setCountry(v);
    setData("basic", { ...data.basic, fullName, country: v, age: age ? Number(age) : null });
  };
  const handleAge = (v: string) => {
    const onlyNum = v.replace(/\D/g, "");
    setAge(onlyNum);
    setData("basic", { ...data.basic, fullName, country, age: onlyNum ? Number(onlyNum) : null });
  };

  const canNext = fullName.trim().length > 1 && country.trim().length > 1;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Basic Information</h1>
      <Progress index={0} />
      <div className="rounded-2xl bg-white border shadow-sm p-5 space-y-3">
        <input className="w-full rounded-xl border px-3 py-2" placeholder="Full name"
               value={fullName} onChange={(e) => handleFullName(e.target.value)} />
        <input className="w-full rounded-xl border px-3 py-2" placeholder="Country"
               value={country} onChange={(e) => handleCountry(e.target.value)} />
        <input className="w-full rounded-xl border px-3 py-2" placeholder="Age"
               value={age} onChange={(e) => handleAge(e.target.value)} />
      </div>
      <StepNav next="/onboarding/steps/interests" canNext={canNext} />
    </div>
  );
}
