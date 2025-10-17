import { NextResponse } from "next/server";
import { SubjectLevel } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const subjectSchema = z.object({
  code: z
    .string()
    .min(2, "ระบุรหัสวิชาอย่างน้อย 2 ตัวอักษร")
    .max(50, "รหัสวิชาไม่ควรเกิน 50 ตัวอักษร")
    .transform((value) => value.trim().toUpperCase()),
  name: z.string().min(2, "กรุณาระบุชื่อวิชา").max(100, "ชื่อวิชาไม่ควรเกิน 100 ตัวอักษร"),
  level: z.nativeEnum(SubjectLevel).optional(),
});

type RouteParams = {
  params: Promise<{
    subjectId: string;
  }>;
};

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { subjectId } = await params;

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, createdById: session.user.id },
      include: { _count: { select: { exams: true, enrollments: true } } },
    });
    if (!subject) {
      return NextResponse.json({ message: "ไม่พบวิชา" }, { status: 404 });
    }

    const body = await request.json();
    const payload = subjectSchema.parse(body);

    if (payload.code !== subject.code) {
      const existing = await prisma.subject.findUnique({
        where: { code: payload.code },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ message: "รหัสวิชานี้ถูกใช้งานแล้ว" }, { status: 409 });
      }
    }

    const updated = await prisma.subject.update({
      where: { id: subject.id },
      data: {
        code: payload.code,
        name: payload.name,
        level: payload.level ?? SubjectLevel.UNSPECIFIED,
      },
      include: {
        _count: {
          select: { exams: true, enrollments: true },
        },
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        level: updated.level,
        createdAt: updated.createdAt,
        examCount: updated._count.exams,
        studentCount: updated._count.enrollments,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถอัปเดตวิชาได้" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { subjectId } = await params;

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, createdById: session.user.id },
      select: { id: true },
    });
    if (!subject) {
      return NextResponse.json({ message: "ไม่พบวิชา" }, { status: 404 });
    }

    await prisma.subject.delete({
      where: { id: subject.id },
    });

    return NextResponse.json({ message: "ลบวิชาเรียบร้อย" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "ไม่สามารถลบวิชาได้" }, { status: 500 });
  }
}
