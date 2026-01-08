import { proxyToUpstreamApi } from "@/lib/server/upstream-proxy";

export async function GET(req: Request) {
  // Frontend: /api/admin/stats
  // NOTE: Prefer calling /api/legacy/admin/stats from the browser.
  // Upstream (legacy): /admin/stats
  return proxyToUpstreamApi(req, "/admin/stats");
}
