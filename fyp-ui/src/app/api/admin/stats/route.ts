import { proxyToUpstreamApi } from "@/lib/server/upstream-proxy";

export async function GET(req: Request) {
  // Frontend: /api/admin/stats
  // Upstream: /api/admin/stats
  return proxyToUpstreamApi(req, "/api/admin/stats");
}
