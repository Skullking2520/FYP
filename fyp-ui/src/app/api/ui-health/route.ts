import { NextResponse } from "next/server";

export function GET() {
  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    null;

  const commitRef =
    process.env.VERCEL_GIT_COMMIT_REF ??
    process.env.GITHUB_REF_NAME ??
    process.env.GITHUB_REF ??
    null;

  return NextResponse.json(
    {
      ok: true,
      service: "fyp-ui",
      now: new Date().toISOString(),
      commitSha,
      commitRef,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
