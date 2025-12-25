"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { isAdminUser } from "@/lib/admin";

export function Sidebar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const isAdmin = isAdminUser(user);

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r bg-white p-4 flex-col">
      <nav className="space-y-2 text-sm">
        <Link className="block" href="/dashboard">
          Dashboard
        </Link>
        <Link className="block" href="/recommendations">
          Recommendations
        </Link>
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
            router.push("/login");
          }}
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
