import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStandardExamQuestions, StandardExamQuestionError } from "@/lib/services/exam-questions";

const createExamSchema = z
  .object({
    title: z.string().min(2, "กรุณาระบุชื่อข้อสอบ").max(150, "ชื่อข้อสอบยาวเกินไป"),
    subjectId: z.string().cuid("รหัสวิชาไม่ถูกต้อง"),
    isAdaptive: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    questionCount: z.coerce.number().int().min(1).max(100).optional(),
    difficultyMin: z.coerce.number().int().min(1).max(5).optional(),
    difficultyMax: z.coerce.number().int().min(1).max(5).optional(),
  })
  .refine(
    (data) => {
      if (data.difficultyMin == null || data.difficultyMax == null) {
        return true;
      }
      return data.difficultyMin <= data.difficultyMax;
    },
    {
      message: "ช่วงความยากไม่ถูกต้อง",
      path: ["difficultyMax"],
    },
  );

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

    const questionCount = payload.questionCount ?? 10;
    const difficultyMin = payload.difficultyMin ?? 1;
    const difficultyMax = payload.difficultyMax ?? 5;

    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          title: payload.title,
          subjectId: subject.id,
          isAdaptive: payload.isAdaptive ?? true,
          isPublic: payload.isPublic ?? false,
          createdById: session.user.id,
          questionCount,
          difficultyMin,
          difficultyMax,
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

      if (!created.isAdaptive) {
        await ensureStandardExamQuestions(
          tx,
          {
            examId: created.id,
            teacherId: session.user.id,
            subjectName: subject.name,
            questionCount,
          },
          { force: true },
        );
      }

      return created;
    });

    return NextResponse.json({
      data: {
        id: exam.id,
        title: exam.title,
        isAdaptive: exam.isAdaptive,
        isPublic: exam.isPublic,
        subjectId: exam.subjectId,
        subjectName: exam.subjectRef.name,
        subjectCode: exam.subjectRef.code,
        attemptCount: exam._count.attempts,
        createdAt: exam.createdAt,
        questionCount: exam.questionCount,
        difficultyMin: exam.difficultyMin,
        difficultyMax: exam.difficultyMax,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    if (error instanceof StandardExamQuestionError) {
      return NextResponse.json(
        {
          message: `ข้อสอบ Standard ต้องการอย่างน้อย ${error.required} ข้อ แต่มีพร้อมเพียง ${error.available} ข้อ`,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "ไม่สามารถสร้างข้อสอบได้" }, { status: 500 });
  }
}
