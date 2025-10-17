"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const formSchema = z
  .object({
    name: z.string().min(2, "กรุณากรอกชื่อ"),
    email: z.string().email("กรุณากรอกอีเมลที่ถูกต้อง"),
    password: z.string().min(6, "รหัสผ่านอย่างน้อย 6 ตัว"),
    confirmPassword: z.string().min(6, "ยืนยันรหัสผ่านอย่างน้อย 6 ตัว"),
    role: z
      .enum(["student", "teacher"])
      .refine((value) => !!value, { message: "เลือกบทบาท" }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

// Handles user registration and redirects to login
export const RegisterForm = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "student",
    },
  });

  // Submit handler that posts to the auth API
  const onSubmit = async (values: FormValues) => {
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.message ?? "ไม่สามารถสมัครสมาชิกได้");
      return;
    }

    setSuccess("สร้างบัญชีสำเร็จแล้ว! ไปหน้าเข้าสู่ระบบ");
    setTimeout(() => router.push("/login"), 1000);
  };

  return (
    <Card className="w-full max-w-2xl">
      {/* Render form header */}
      <CardHeader>
        <CardTitle>สมัครสมาชิก</CardTitle>
        <CardDescription>สร้างบัญชีเพื่อใช้งานระบบ Smart Exam</CardDescription>
      </CardHeader>
      {/* Render form inputs */}
      <CardContent>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
            ชื่อ-นามสกุล
            <Input placeholder="ชื่อเต็ม" {...form.register("name")} />
            {form.formState.errors.name && (
              <span className="text-xs text-destructive">{form.formState.errors.name.message}</span>
            )}
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
            อีเมล
            <Input placeholder="you@example.com" type="email" {...form.register("email")} />
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
          <label className="flex flex-col gap-2 text-sm font-medium">
            ยืนยันรหัสผ่าน
            <Input placeholder="••••••••" type="password" {...form.register("confirmPassword")} />
            {form.formState.errors.confirmPassword && (
              <span className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</span>
            )}
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
            บทบาท
            <select
            {...form.register("role")}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
              <option value="student">นักเรียน</option>
              <option value="teacher">ครู</option>
          </select>
            {form.formState.errors.role && (
              <span className="text-xs text-destructive">{form.formState.errors.role.message}</span>
            )}
          </label>
          {error && (
            <p className="md:col-span-2 rounded-md bg-destructive/15 p-2 text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="md:col-span-2 rounded-md bg-emerald-100 p-2 text-sm text-emerald-700">{success}</p>
          )}
          <div className="md:col-span-2">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "กำลังบันทึก..." : "สร้างบัญชี"}
            </Button>
          </div>
        </form>
      </CardContent>
      {/* Render footer links */}
      <CardFooter className="justify-between text-sm">
        <span className="text-muted-foreground">มีบัญชีอยู่แล้ว?</span>
        <Button asChild variant="link" className="px-0 text-primary">
          <Link href="/login">กลับไปเข้าสู่ระบบ</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
