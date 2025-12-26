function getAdminEmailSet(): Set<string> {
  const rawList = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  const rawSingle = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const values = (rawList ?? rawSingle ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  const set = new Set(values);
  // Safe default for local/dev: backend commonly seeds this admin user.
  if (set.size === 0) {
    set.add("admin@admin.com");
  }
  return set;
}

export function isAdminUserEmail(email?: string | null): boolean {
  const userEmail = (email ?? "").trim().toLowerCase();
  if (!userEmail) return false;
  const allow = getAdminEmailSet();
  return allow.has(userEmail);
}

type AdminUserLike = {
  email?: string | null;
  is_admin?: boolean | null;
  isAdmin?: boolean | null;
  is_superuser?: boolean | null;
  isSuperuser?: boolean | null;
  is_staff?: boolean | null;
  role?: string | null;
  roles?: unknown;
};

export function isAdminUser(user?: AdminUserLike | null): boolean {
  const toBool = (v: unknown): boolean => {
    if (v === true) return true;
    if (v === 1) return true;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      return s === "true" || s === "1" || s === "yes";
    }
    return false;
  };

  if (toBool(user?.is_admin)) return true;
  if (toBool(user?.isAdmin)) return true;
  if (toBool(user?.is_superuser)) return true;
  if (toBool(user?.isSuperuser)) return true;
  if (toBool(user?.is_staff)) return true;
  if (typeof user?.role === "string" && user.role.toLowerCase() === "admin") return true;
  if (Array.isArray(user?.roles) && user.roles.some((r) => typeof r === "string" && r.toLowerCase() === "admin")) return true;
  return isAdminUserEmail(user?.email);
}
