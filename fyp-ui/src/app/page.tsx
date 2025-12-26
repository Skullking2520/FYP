"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPostAuthRedirectPath } from "@/lib/resume";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window === "undefined" ? null : window.localStorage.getItem("careerpath_access_token");
    router.replace(token ? getPostAuthRedirectPath() : "/login");
  }, [router]);

  return null;
}
