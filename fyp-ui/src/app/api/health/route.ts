import { proxyToUpstreamApi } from "@/lib/server/upstream-proxy";

// Health passthrough to upstream backend.
// Tries `/health` first (common), then falls back to `/api/health`.
export async function GET(req: Request) {
  const primary = await proxyToUpstreamApi(req, "/health");
  if (primary.status !== 404) return primary;
  return proxyToUpstreamApi(req, "/api/health");
}
