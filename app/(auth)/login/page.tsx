import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | Smart Exam",
};

// Login page with credential form
export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Render logo and navigation */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Smart Exam</h1>
        <p className="text-sm text-muted-foreground">
          หรือ{" "}
          <Link href="/register" className="underline">
            สมัครบัญชีใหม่
          </Link>
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
