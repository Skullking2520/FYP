"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { isAdminUser, isAdminUserEmail } from "@/lib/admin";
import { getDashboardEntryPath, getRecommendationEntryPath } from "@/lib/resume";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout } = useAuth();

  // RootLayout renders Sidebar for every route; hide it on auth pages and when logged out.
  if (!token) return null;
  if (pathname === "/login" || pathname === "/register") return null;

  const persistedEmail = typeof window === "undefined" ? null : window.localStorage.getItem("careerpath_login_email");
  const isAdmin = isAdminUser(user) || isAdminUserEmail(persistedEmail);

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r bg-white p-4 flex-col">
      <nav className="space-y-2 text-sm">
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => router.push(getDashboardEntryPath())}
        >
          Onboarding
        </button>
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => router.push(getRecommendationEntryPath())}
        >
          Recommendations
        </button>
        <Link className="block" href="/profile">
          Profile
        </Link>
        {isAdmin && (
          <Link className="block" href="/admin">
            Admin
          </Link>
        )}
      </nav>

      <div className="mt-auto pt-4">
        <button
          type="button"
          className="w-full rounded-xl border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          onClick={() => {
            logout();
            router.replace("/login");
            router.refresh();
          }}
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
