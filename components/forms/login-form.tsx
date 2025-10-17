"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const formSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormValues = z.infer<typeof formSchema>;

// Handles login flow with credentials provider
export const LoginForm = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Submit handler that calls NextAuth signIn
  const onSubmit = async (values: FormValues) => {
    setError(null);
    const result = await signIn("credentials", {
      ...values,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push("/");
  };

  return (
    <Card className="w-full max-w-md">
      {/* Render form header */}
      <CardHeader>
        <CardTitle>เข้าสู่ระบบ</CardTitle>
        <CardDescription>จัดการข้อสอบและความคืบหน้าด้วยบัญชีของคุณ</CardDescription>
      </CardHeader>
      {/* Render form inputs */}
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <label className="flex flex-col gap-2 text-sm font-medium">
            อีเมล
            <Input placeholder="teacher@example.com" type="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <span className="text-xs text-destructive">{form.formState.errors.email.message}</span>
            )}
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            รหัสผ่าน
            <Input placeholder="••••••••" type="password" {...form.register("password")} />
            {form.formState.errors.password && (
              <span className="text-xs text-destructive">{form.formState.errors.password.message}</span>
            )}
          </label>
          {error && <p className="rounded-md bg-destructive/15 p-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>
        </form>
      </CardContent>
      {/* Render footer links */}
      <CardFooter className="justify-between text-sm">
        <span className="text-muted-foreground">ยังไม่มีบัญชี?</span>
        <Button asChild variant="link" className="px-0 text-primary">
          <Link href="/register">สมัครสมาชิก</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
