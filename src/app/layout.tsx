import "./globals.css";
import Providers from "@/components/ui/providers";

export const metadata = {
  title: "CareerPath.AI",
  description: "AI Career & Course Recommendation Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <Providers>
          <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r bg-white p-4 flex-col">
            <nav className="space-y-2 text-sm">
              <a className="block" href="/dashboard">Dashboard</a>
              <a className="block" href="/recommendations">Recommendations</a>
              <a className="block" href="/profile">Profile</a>
              <a className="block" href="/admin">Admin</a>
            </nav>
          </aside>
          <main className="md:ml-64 min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
