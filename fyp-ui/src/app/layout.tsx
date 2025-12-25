import "./globals.css";
import Providers from "@/components/ui/providers";
import { Sidebar } from "@/components/sidebar";

export const metadata = {
  title: "CareerPath.AI",
  description: "AI Career & Course Recommendation Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <Providers>
          <Sidebar />
          <main className="md:ml-64 min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
