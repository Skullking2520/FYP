import { NextResponse } from "next/server";

import type { AcademicsLevel } from "@/lib/academics/subjects";

function getApiBaseUrl(): string {
  const baseUrl =
    process.env.UPSTREAM_API_BASE_URL ??
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "Upstream base URL is not set. Set UPSTREAM_API_BASE_URL (preferred) or API_BASE_URL or NEXT_PUBLIC_API_BASE_URL.",
    );
  }
  return baseUrl.replace(/\/$/, "");
}

function parseLevel(value: string | null): AcademicsLevel {
  return value === "alevel" ? "alevel" : "olevel";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const stageParam = url.searchParams.get("stage") ?? url.searchParams.get("level");
  const stage = parseLevel(stageParam);
  const q = url.searchParams.get("q") ?? "";
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(200, Math.max(1, Number(limitRaw ?? 200) || 200));

  // Backend endpoint (provided): GET /api/education/subjects?stage=alevel|olevel&q=...&limit=1..200
  try {
    const upstreamParams = new URLSearchParams();
    upstreamParams.set("stage", stage);
    if (q.trim()) upstreamParams.set("q", q.trim());
    upstreamParams.set("limit", String(limit));

    const upstreamUrl = `${getApiBaseUrl()}/api/education/subjects?${upstreamParams.toString()}`;
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      let detail = `Request failed with status ${upstream.status}`;
      try {
        const body = (await upstream.json()) as unknown;
        if (body && typeof body === "object" && "detail" in body) {
          const maybeDetail = (body as Record<string, unknown>).detail;
          if (typeof maybeDetail === "string") detail = maybeDetail;
        }
      } catch {
        // ignore
      }
      return NextResponse.json({ detail }, { status: upstream.status });
    }

    const data = (await upstream.json()) as unknown;
    const subjects =
      data && typeof data === "object" && "items" in data && Array.isArray((data as any).items)
        ? ((data as any).items as unknown[]).filter((s) => typeof s === "string")
        : null;

    if (!subjects) {
      return NextResponse.json({ detail: "Invalid response from backend subject API" }, { status: 502 });
    }

    return NextResponse.json({ stage, subjects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach backend subject API";
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
