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

async function parseBackendErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as Record<string, unknown>).detail;
      if (typeof detail === "string") return detail;
    }
  } catch {
    // ignore
  }
  return `Request failed with status ${response.status}`;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth) {
    return NextResponse.json({ detail: "Missing Authorization header" }, { status: 401 });
  }

  const url = `${getApiBaseUrl()}/admin/stats`;

  const upstream = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: auth,
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json({ detail: await parseBackendErrorMessage(upstream) }, { status: upstream.status });
  }

  const data = (await upstream.json()) as unknown;
  return NextResponse.json(data);
}
