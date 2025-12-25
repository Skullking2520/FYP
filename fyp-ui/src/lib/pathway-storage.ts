export type StoredSelectedJob = {
  job_id: string;
  title?: string;
};

export type StoredSelectedMajor = {
  major_id: string;
  major_name?: string;
};

const SELECTED_JOB_KEY = "selected_job_v1";
const SELECTED_MAJOR_KEY = "selected_major_v1";

export function loadSelectedJob(): StoredSelectedJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SELECTED_JOB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const job_id = (parsed as { job_id?: unknown }).job_id;
    const title = (parsed as { title?: unknown }).title;
    if (typeof job_id !== "string" || !job_id.trim()) return null;
    return {
      job_id,
      title: typeof title === "string" && title.trim() ? title : undefined,
    };
  } catch {
    return null;
  }
}

export function saveSelectedJob(job: StoredSelectedJob): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELECTED_JOB_KEY, JSON.stringify(job));
}

export function clearSelectedJob(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SELECTED_JOB_KEY);
}

export function loadSelectedMajor(): StoredSelectedMajor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SELECTED_MAJOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const major_id = (parsed as { major_id?: unknown }).major_id;
    const major_name = (parsed as { major_name?: unknown }).major_name;
    if (typeof major_id !== "string" || !major_id.trim()) return null;
    return {
      major_id,
      major_name: typeof major_name === "string" && major_name.trim() ? major_name : undefined,
    };
  } catch {
    return null;
  }
}

export function saveSelectedMajor(major: StoredSelectedMajor): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELECTED_MAJOR_KEY, JSON.stringify(major));
}

export function clearSelectedMajor(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SELECTED_MAJOR_KEY);
}
