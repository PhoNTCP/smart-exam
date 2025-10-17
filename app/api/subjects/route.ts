import { NextResponse } from "next/server";
import { SubjectLevel } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSubjectSchema = z.object({
  code: z
    .string()
    .min(2, "ระบุรหัสวิชาอย่างน้อย 2 ตัวอักษร")
    .max(50, "รหัสวิชาไม่ควรเกิน 50 ตัวอักษร")
    .transform((value) => value.trim().toUpperCase()),
  name: z.string().min(2, "กรุณาระบุชื่อวิชา").max(100, "ชื่อวิชาไม่ควรเกิน 100 ตัวอักษร"),
  level: z.nativeEnum(SubjectLevel).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const payload = createSubjectSchema.parse(body);

    const existing = await prisma.subject.findUnique({
      where: { code: payload.code },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ message: "รหัสวิชานี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const subject = await prisma.subject.create({
      data: {
        code: payload.code,
        name: payload.name,
        level: payload.level ?? SubjectLevel.UNSPECIFIED,
        createdById: session.user.id,
      },
      include: {
        _count: {
          select: {
            exams: true,
            enrollments: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        id: subject.id,
        code: subject.code,
        name: subject.name,
        level: subject.level,
        createdAt: subject.createdAt,
        examCount: subject._count.exams,
        studentCount: subject._count.enrollments,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถสร้างวิชาได้" }, { status: 500 });
  }
}
