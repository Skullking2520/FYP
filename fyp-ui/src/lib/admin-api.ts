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
  const response = await fetch("/api/legacy/admin/stats", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return (await response.json()) as AdminStats;
  }

  throw new Error(await parseErrorMessage(response));
}
