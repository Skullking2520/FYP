import type { AdminStats } from "@/types/admin";

async function parseErrorMessage(response: Response): Promise<string> {
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

export async function getAdminStats(token: string): Promise<AdminStats> {
  // Prefer endpoints that exist in older backend deployments first to avoid noisy 404s.
  const paths = ["/api/legacy/api/admin/stats", "/api/legacy/admin/stats", "/api/admin/stats"];
  let lastError: string | null = null;

  for (const path of paths) {
    const response = await fetch(path, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return (await response.json()) as AdminStats;
    }

    lastError = await parseErrorMessage(response);
  }

  throw new Error(lastError ?? "Failed to load admin stats");
}
