export function getAdminEmail(): string | null {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function isAdminUserEmail(email?: string | null): boolean {
  const adminEmail = getAdminEmail();
  if (!adminEmail) return false;
  const userEmail = (email ?? "").trim().toLowerCase();
  return userEmail === adminEmail;
}

type AdminUserLike = {
  email?: string | null;
  is_admin?: boolean | null;
};

export function isAdminUser(user?: AdminUserLike | null): boolean {
  if (user?.is_admin === true) return true;
  return isAdminUserEmail(user?.email);
}
