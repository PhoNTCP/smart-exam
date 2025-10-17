import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createExamSchema = z.object({
  title: z.string().min(2, "กรุณาระบุชื่อข้อสอบ").max(150, "ชื่อข้อสอบยาวเกินไป"),
  subjectId: z.string().cuid("รหัสวิชาไม่ถูกต้อง"),
  isAdaptive: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const payload = createExamSchema.parse(body);

    const subject = await prisma.subject.findFirst({
      where: { id: payload.subjectId, createdById: session.user.id },
      select: { id: true, name: true, code: true },
    });
    if (!subject) {
      return NextResponse.json({ message: "ไม่พบวิชาที่เลือก" }, { status: 404 });
    }

    const exam = await prisma.exam.create({
      data: {
        title: payload.title,
        subjectId: subject.id,
        isAdaptive: payload.isAdaptive ?? true,
        createdById: session.user.id,
      },
      include: {
        subjectRef: {
          select: { name: true, code: true },
        },
        _count: {
          select: { attempts: true },
        },
      },
    });

    return NextResponse.json({
      data: {
        id: exam.id,
        title: exam.title,
        isAdaptive: exam.isAdaptive,
        subjectId: exam.subjectId,
        subjectName: exam.subjectRef.name,
        subjectCode: exam.subjectRef.code,
        attemptCount: exam._count.attempts,
        createdAt: exam.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถสร้างข้อสอบได้" }, { status: 500 });
  }
}
