import { NextResponse } from "next/server";

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage") ?? url.searchParams.get("level") ?? "";
  const subject = url.searchParams.get("subject") ?? "";
  const grade = url.searchParams.get("grade") ?? "";

  // Backend endpoint: GET /api/education/subjects/mapped-skills?stage=...&subject=...&grade=...
  try {
    const upstreamParams = new URLSearchParams();
    if (stage.trim()) upstreamParams.set("stage", stage.trim());
    if (subject.trim()) upstreamParams.set("subject", subject.trim());
    if (grade.trim()) upstreamParams.set("grade", grade.trim());

    const upstreamUrl = `${getApiBaseUrl()}/api/education/subjects/mapped-skills?${upstreamParams.toString()}`;
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { accept: "application/json" },
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

    const data = await upstream.arrayBuffer();
    return new NextResponse(data, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach backend mapped-skills API";
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
