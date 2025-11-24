import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{
    examId: string;
  }>;
};

const setQuestionsSchema = z.object({
  questionIds: z.array(z.string().cuid()).min(1, "ต้องมีคำถามอย่างน้อย 1 ข้อ"),
});

const formatQuestion = (question: {
  id: string;
  body: string;
  subject: string;
  gradeLevel: string;
  aiScores: Array<{ difficulty: number | null; reason: string | null; modelName: string | null }>;
}) => ({
  id: question.id,
  body: question.body,
  subject: question.subject,
  gradeLevel: question.gradeLevel,
  difficulty: question.aiScores[0]?.difficulty ?? null,
});

export async function GET(_request: Request, { params }: RouteParams) {
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
        standardQuestions: {
          include: {
            question: {
              include: { aiScores: { orderBy: { createdAt: "desc" }, take: 1 } },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ message: "ไม่พบข้อสอบ" }, { status: 404 });
    }
    if (exam.isAdaptive) {
      return NextResponse.json({ message: "ข้อสอบ Adaptive ไม่รองรับการตั้งชุดคำถามเอง" }, { status: 400 });
    }

    const selected = exam.standardQuestions
      .map((entry) => entry.question)
      .filter(Boolean)
      .map((q) => formatQuestion(q));

    return NextResponse.json({ data: selected });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "ไม่สามารถดึงคำถามของข้อสอบได้" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { examId } = await params;
    const exam = await prisma.exam.findFirst({
      where: { id: examId, createdById: session.user.id },
      include: { subjectRef: true },
    });

    if (!exam) {
      return NextResponse.json({ message: "ไม่พบข้อสอบ" }, { status: 404 });
    }
    if (exam.isAdaptive) {
      return NextResponse.json({ message: "ข้อสอบ Adaptive ไม่รองรับการตั้งชุดคำถามเอง" }, { status: 400 });
    }

    const body = await request.json();
    const payload = setQuestionsSchema.parse(body);
    const uniqueIds = Array.from(new Set(payload.questionIds));

    // ตรวจสอบว่าคำถามเป็นของครูคนเดียวกันและตรงวิชาเดียวกัน
    const questions = await prisma.question.findMany({
      where: {
        id: { in: uniqueIds },
        createdById: session.user.id,
        ...(exam.subjectRef?.name ? { subject: exam.subjectRef.name } : {}),
      },
      include: { aiScores: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (questions.length !== uniqueIds.length) {
      return NextResponse.json({ message: "พบคำถามที่ไม่สามารถใช้ได้ในข้อสอบนี้" }, { status: 400 });
    }

    const prepared = questions
      .sort((a, b) => uniqueIds.indexOf(a.id) - uniqueIds.indexOf(b.id))
      .map((q, index) => ({ id: q.id, order: index, question: q }));

    await prisma.$transaction([
      prisma.examQuestion.deleteMany({ where: { examId } }),
      prisma.examQuestion.createMany({
        data: prepared.map((entry) => ({
          examId,
          questionId: entry.id,
          order: entry.order,
        })),
      }),
      prisma.exam.update({
        where: { id: examId },
        data: { questionCount: prepared.length },
      }),
    ]);

    return NextResponse.json({
      data: prepared.map((entry) => formatQuestion(entry.question)),
      count: prepared.length,
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถบันทึกชุดคำถามได้" }, { status: 500 });
  }
}
