import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RegisterForm } from "@/components/forms/register-form";

export const metadata: Metadata = {
  title: "สมัครสมาชิก | Smart Exam",
};

// Registration page for creating new users
export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Render title and helper */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold">สร้างบัญชี Smart Exam</h1>
        <p className="text-sm text-muted-foreground">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="underline">
            กลับไปเข้าสู่ระบบ
          </Link>
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
