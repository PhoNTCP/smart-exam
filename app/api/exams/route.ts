import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStandardExamQuestions, StandardExamQuestionError } from "@/lib/services/exam-questions";
import { PERFORMANCE_DIFFICULTY_MODEL } from "@/lib/services/question-difficulty";

const createExamSchema = z
  .object({
    title: z.string().min(2, "กรุณาระบุชื่อข้อสอบ").max(150, "ชื่อข้อสอบยาวเกินไป"),
    subjectId: z.string().cuid("รหัสวิชาไม่ถูกต้อง"),
    isAdaptive: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    questionCount: z.coerce.number().int().min(1).max(100).optional(),
    confirmIncompleteCoverage: z.boolean().optional(),
  });

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const teacherId = session.user.id;

    const body = await request.json();
    const payload = createExamSchema.parse(body);

    const subject = await prisma.subject.findFirst({
      where: { id: payload.subjectId, createdById: teacherId },
      select: { id: true, name: true, code: true },
    });
    if (!subject) {
      return NextResponse.json({ message: "ไม่พบวิชาที่เลือก" }, { status: 404 });
    }

    const questionCount = payload.questionCount ?? 10;
    const isAdaptive = payload.isAdaptive ?? true;

    if (isAdaptive) {
      const subjectQuestions = await prisma.question.findMany({
        where: {
          createdById: teacherId,
          subject: subject.name,
        },
        select: {
          id: true,
          aiScores: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              difficulty: true,
              modelName: true,
            },
          },
        },
      });

      const eligibleQuestions = subjectQuestions.filter((question) => {
        const latestScore = question.aiScores[0];
        return latestScore?.modelName === PERFORMANCE_DIFFICULTY_MODEL && latestScore.difficulty != null;
      });

      const difficultyCoverage = new Set(
        eligibleQuestions
          .map((question) => question.aiScores[0]?.difficulty)
          .filter((difficulty): difficulty is number => difficulty != null),
      );

      if (eligibleQuestions.length < questionCount) {
        console.log("Eligible Questions:", eligibleQuestions.length);
        console.log("Difficulty Coverage:", difficultyCoverage.size);
        console.log("Required Questions:", questionCount);
        return NextResponse.json(
          {
            message:
              "ยังสร้างข้อสอบ Adaptive ไม่ได้ เพราะคำถามที่มีระดับความยากจากข้อมูลจริงยังไม่เพียงพอ ต้องมีข้อที่คำนวณระดับความยากแล้วให้ครบตามจำนวนข้อสอบก่อน",
            eligibleQuestions: eligibleQuestions.length,
            difficultyCoverage: Array.from(difficultyCoverage).sort((a, b) => a - b),
            requiredQuestions: questionCount,
          },
          { status: 400 },
        );
      }

      if (difficultyCoverage.size < 5 && !payload.confirmIncompleteCoverage) {
        return NextResponse.json(
          {
            message: `ระดับความยากยังไม่ครบ 5 ระดับ ตอนนี้มี ${difficultyCoverage.size} ระดับ (${Array.from(
              difficultyCoverage,
            )
              .sort((a, b) => a - b)
              .join(", ") || "-"}) หากสร้างต่อ ระบบ Adaptive จะใช้เฉพาะระดับที่มีอยู่`,
            eligibleQuestions: eligibleQuestions.length,
            difficultyCoverage: Array.from(difficultyCoverage).sort((a, b) => a - b),
            requiredQuestions: questionCount,
            requiresConfirmation: true,
          },
          { status: 409 },
        );
      }
    }

    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          title: payload.title,
          subjectId: subject.id,
          isAdaptive,
          isPublic: payload.isPublic ?? false,
          createdById: teacherId,
          questionCount,
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
            teacherId,
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
