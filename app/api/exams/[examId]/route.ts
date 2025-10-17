import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateExamSchema = z.object({
  title: z.string().min(2, "กรุณาระบุชื่อข้อสอบ").max(150, "ชื่อข้อสอบยาวเกินไป").optional(),
  subjectId: z.string().cuid("รหัสวิชาไม่ถูกต้อง").optional(),
  isAdaptive: z.boolean().optional(),
});

type RouteParams = {
  params: Promise<{
    examId: string;
  }>;
};

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { examId } = await params;
    const exam = await prisma.exam.findFirst({
      where: { id: examId, createdById: session.user.id },
      include: {
        subjectRef: true,
        _count: { select: { attempts: true } },
      },
    });

    if (!exam) {
      return NextResponse.json({ message: "ไม่พบข้อสอบ" }, { status: 404 });
    }

    const body = await request.json();
    const payload = updateExamSchema.parse(body);

    let subjectId = exam.subjectId;
    if (payload.subjectId && payload.subjectId !== exam.subjectId) {
      const subject = await prisma.subject.findFirst({
        where: { id: payload.subjectId, createdById: session.user.id },
        select: { id: true },
      });
      if (!subject) {
        return NextResponse.json({ message: "ไม่พบวิชาที่เลือก" }, { status: 404 });
      }
      subjectId = subject.id;
    }

    const updated = await prisma.exam.update({
      where: { id: exam.id },
      data: {
        title: payload.title ?? exam.title,
        subjectId,
        isAdaptive: payload.isAdaptive ?? exam.isAdaptive,
      },
      include: {
        subjectRef: true,
        _count: { select: { attempts: true } },
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        title: updated.title,
        isAdaptive: updated.isAdaptive,
        subjectId: updated.subjectId,
        subjectName: updated.subjectRef?.name ?? "",
        subjectCode: updated.subjectRef?.code ?? "",
        attemptCount: updated._count.attempts,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถอัปเดตข้อสอบได้" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { examId } = await params;
    const exam = await prisma.exam.findFirst({
      where: { id: examId, createdById: session.user.id },
      select: { id: true },
    });

    if (!exam) {
      return NextResponse.json({ message: "ไม่พบข้อสอบ" }, { status: 404 });
    }

    await prisma.exam.delete({
      where: { id: exam.id },
    });

    return NextResponse.json({ message: "ลบข้อสอบเรียบร้อย" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "ไม่สามารถลบข้อสอบได้" }, { status: 500 });
  }
}
