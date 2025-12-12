"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { isAdminUserEmail } from "@/lib/admin";

export function Sidebar() {
  const { user } = useAuth();
  const isAdmin = isAdminUserEmail(user?.email);

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
    </aside>
  );
}
