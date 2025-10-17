import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smart Exam | Auth",
};

// Auth layout that centers content
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      {children}
    </div>
  );
}
