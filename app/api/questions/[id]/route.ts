import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { questionUpdateSchema } from "@/lib/validators/question";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

const formatQuestion = (question: {
  id: string;
  subject: string;
  gradeLevel: string;
  body: string;
  explanation: string;
  shouldRescore: boolean;
  createdAt: Date;
  updatedAt: Date;
  choices: Array<{ id: string; text: string; isCorrect: boolean; order: number }>;
  aiScores: Array<{ difficulty: number | null; reason: string | null }>;
}) => ({
  id: question.id,
  subject: question.subject,
  gradeLevel: question.gradeLevel,
  body: question.body,
  explanation: question.explanation,
  shouldRescore: question.shouldRescore,
  createdAt: question.createdAt,
  updatedAt: question.updatedAt,
  difficulty: question.aiScores[0]?.difficulty ?? null,
  aiReason: question.aiScores[0]?.reason ?? null,
  choices: question.choices,
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const userId = session.user.id;

    const { id } = paramsSchema.parse(await context.params);

    const body = await request.json();
    const parsed = questionUpdateSchema.parse({ ...body, id });
    const shouldRescore = parsed.shouldRescore ?? false;

    const existing = await prisma.question.findFirst({
      where: { id, createdById: userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ message: "ไม่พบคำถาม" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.choice.deleteMany({ where: { questionId: id } });

      await tx.question.update({
        where: { id },
        data: {
          subject: parsed.subject,
          gradeLevel: parsed.gradeLevel,
          body: parsed.body,
          explanation: parsed.explanation,
          shouldRescore,
        },
        include: {
          aiScores: { orderBy: { createdAt: "desc" }, take: 1, select: { difficulty: true, reason: true } },
          choices: { orderBy: { order: "asc" } },
        },
      });

      await tx.choice.createMany({
        data: parsed.choices.map((choice, index) => ({
          questionId: id,
          text: choice.text,
          isCorrect: choice.isCorrect,
          order: choice.order ?? index,
        })),
      });

      return tx.question.findUniqueOrThrow({
        where: { id },
        include: {
          choices: { orderBy: { order: "asc" } },
          aiScores: { orderBy: { createdAt: "desc" }, take: 1, select: { difficulty: true, reason: true } },
        },
      });
    });

    return NextResponse.json({ data: formatQuestion(updated) });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() },
        { status: 422 },
      );
    }
    return NextResponse.json({ message: "ไม่สามารถแก้ไขคำถามได้" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const userId = session.user.id;

    const { id } = paramsSchema.parse(await context.params);

    const existing = await prisma.question.findFirst({
      where: { id, createdById: userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ message: "ไม่พบคำถาม" }, { status: 404 });
    }

    await prisma.question.delete({ where: { id } });

    return NextResponse.json({ message: "ลบสำเร็จ" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "ไม่สามารถลบคำถามได้" }, { status: 500 });
  }
}
