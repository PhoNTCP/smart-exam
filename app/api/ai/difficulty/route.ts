import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  accuracyFromStats,
  difficultyFromAccuracy,
  MIN_RELIABLE_ATTEMPTS,
  PERFORMANCE_DIFFICULTY_MODEL,
  summarizeDifficultyStats,
} from "@/lib/services/question-difficulty";

const bodySchema = z.object({
  questionId: z.string().cuid(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { questionId } = bodySchema.parse(body);

    const question = await prisma.question.findFirst({
      where: { id: questionId, createdById: session.user.id },
      select: { id: true },
    });

    if (!question) {
      return NextResponse.json({ message: "ไม่พบคำถาม" }, { status: 404 });
    }

    const answers = await prisma.attemptAnswer.findMany({
      where: { questionId },
      select: { isCorrect: true },
    });

    const totalAttempts = answers.length;
    if (totalAttempts === 0) {
      return NextResponse.json({ message: "ข้อนี้ยังไม่มีข้อมูลการทำข้อสอบ" }, { status: 400 });
    }

    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    const incorrectCount = totalAttempts - correctCount;
    const accuracyPercent = accuracyFromStats(correctCount, totalAttempts);
    const difficulty = difficultyFromAccuracy(accuracyPercent);
    const reason = summarizeDifficultyStats({
      totalAttempts,
      correctCount,
      incorrectCount,
      accuracyPercent,
      difficulty,
    });

    const score = await prisma.aiScore.create({
      data: {
        questionId,
        difficulty,
        reason,
        modelName: PERFORMANCE_DIFFICULTY_MODEL,
      },
    });

    await prisma.question.update({
      where: { id: questionId },
      data: { shouldRescore: false },
    });

    return NextResponse.json({
      data: {
        questionId,
        difficulty: score.difficulty,
        reason: score.reason,
        modelName: score.modelName,
        totalAttempts,
        correctCount,
        incorrectCount,
        accuracyPercent,
        isReliableSample: totalAttempts >= MIN_RELIABLE_ATTEMPTS,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถคำนวณความยากได้" }, { status: 500 });
  }
}
