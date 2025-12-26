"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { rememberLastPath } from "@/lib/resume";

export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    rememberLastPath(pathname);
  }, [pathname]);

  return null;
}
