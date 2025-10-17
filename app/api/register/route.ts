import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Handles registration requests from the client
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, role } = body as {
      name?: string;
      email?: string;
      password?: string;
      role?: "student" | "teacher";
    };

    // Validate required payload
    if (!name || !email || !password || !role) {
      return NextResponse.json({ message: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    // Check for email duplication
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json({ message: "อีเมลนี้ถูกใช้แล้ว" }, { status: 409 });
    }

    // Persist user record and hashed password
    await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: await hash(password, 10),
        role,
      },
    });

    return NextResponse.json({ message: "สร้างบัญชีเรียบร้อย" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
  }
}
