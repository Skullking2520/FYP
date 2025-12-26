import { proxyToUpstreamApi } from "@/lib/server/upstream-proxy";

function rawPathnameFromRequestUrl(req: Request): string {
  const full = req.url;
  const qIndex = full.indexOf("?");
  const withoutQuery = qIndex >= 0 ? full.slice(0, qIndex) : full;
  const origin = new URL(full).origin;
  if (withoutQuery.startsWith(origin)) {
    return withoutQuery.slice(origin.length) || "/";
  }
  // Fallback (shouldn't happen in normal Next runtimes)
  return new URL(full).pathname;
}

function toUpstreamPathFromRequest(req: Request): string {
  // Frontend: /api/<rest>
  // Upstream FastAPI: /api/<rest>
  // IMPORTANT: Do NOT use Next.js catch-all params here.
  // Params are decoded, which turns `%2F` into `/` and breaks upstream routes for
  // encoded IDs like ESCO URIs.
  return rawPathnameFromRequestUrl(req);
}

export async function GET(req: Request) {
  return proxyToUpstreamApi(req, toUpstreamPathFromRequest(req));
}

export async function POST(req: Request) {
  return proxyToUpstreamApi(req, toUpstreamPathFromRequest(req));
}

export async function PUT(req: Request) {
  return proxyToUpstreamApi(req, toUpstreamPathFromRequest(req));
}

export async function PATCH(req: Request) {
  return proxyToUpstreamApi(req, toUpstreamPathFromRequest(req));
}

export async function DELETE(req: Request) {
  return proxyToUpstreamApi(req, toUpstreamPathFromRequest(req));
}
