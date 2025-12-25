import { NextResponse } from "next/server";

function getUpstreamBaseUrl(): string {
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

function withDebugHeaders(headers: Headers, upstreamUrl: string): Headers {
  if (process.env.NODE_ENV === "production") return headers;
  const next = new Headers(headers);
  next.set("x-upstream-url", upstreamUrl);
  return next;
}

function filterResponseHeaders(headers: Headers): Headers {
  const result = new Headers();
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === "connection") continue;
    if (lower === "keep-alive") continue;
    if (lower === "proxy-authenticate") continue;
    if (lower === "proxy-authorization") continue;
    if (lower === "te") continue;
    if (lower === "trailer") continue;
    if (lower === "transfer-encoding") continue;
    if (lower === "upgrade") continue;
    result.set(key, value);
  }
  return result;
}

function buildUpstreamHeaders(req: Request): Headers {
  const headers = new Headers();

  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  return headers;
}

async function proxyRequest(req: Request, upstreamUrl: string): Promise<Response> {
  const method = req.method.toUpperCase();

  const init: RequestInit = {
    method,
    headers: buildUpstreamHeaders(req),
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    const body = await req.arrayBuffer();
    init.body = body.byteLength ? body : undefined;
  }

  return fetch(upstreamUrl, init);
}

async function parseBackendErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (text) {
      try {
        const body = JSON.parse(text) as unknown;
        if (body && typeof body === "object" && "detail" in body) {
          const detail = (body as Record<string, unknown>).detail;
          if (typeof detail === "string" && detail.trim()) return detail;
        }
      } catch {
        // not JSON
      }

      const trimmed = text.trim();
      if (trimmed) {
        // For huge tracebacks, return the tail where the exception message usually is.
        const lines = trimmed.split(/\r?\n/);
        const tail = lines.slice(Math.max(0, lines.length - 8)).join("\n");
        return tail.length > 800 ? `${tail.slice(-800)}` : tail;
      }
    }
  } catch {
    // ignore
  }
  return `Request failed with status ${response.status}`;
}

export async function proxyToUpstreamApi(req: Request, upstreamPath: string) {
  try {
    const baseUrl = getUpstreamBaseUrl();
    const incomingUrl = new URL(req.url);
    const upstreamUrl = `${baseUrl}${upstreamPath}${incomingUrl.search}`;
    const upstream = await proxyRequest(req, upstreamUrl);

    if (!upstream.ok) {
      return NextResponse.json(
        { detail: await parseBackendErrorMessage(upstream) },
        {
          status: upstream.status,
          headers: withDebugHeaders(new Headers(), upstreamUrl),
        },
      );
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: withDebugHeaders(filterResponseHeaders(upstream.headers), upstreamUrl),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream proxy failed";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
