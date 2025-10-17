import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ADAPTIVE_TOTAL,
  formatAttemptSummary,
  recordAnswer,
  toThetaNumber,
} from "@/lib/services/adaptive-engine";

const bodySchema = z.object({
  attemptId: z.string().cuid(),
  questionId: z.string().cuid(),
  choiceId: z.string().cuid(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "student" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const payload = bodySchema.parse(body);

    const result = await recordAnswer({
      attemptId: payload.attemptId,
      userId: session.user.id,
      questionId: payload.questionId,
      choiceId: payload.choiceId,
    });

    if (result.status === "completed") {
      await prisma.studentExam.updateMany({
        where: { attemptId: result.attempt.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        status: "completed",
        summary: {
          ...formatAttemptSummary(result.attempt),
          theta: toThetaNumber(result.attempt.thetaEnd),
        },
        answeredCount: result.answeredCount,
        total: ADAPTIVE_TOTAL,
        isCorrect: result.isCorrect,
      });
    }

    return NextResponse.json({
      status: "in-progress",
      question: result.question,
      answeredCount: result.answeredCount,
      total: ADAPTIVE_TOTAL,
      theta: result.thetaAfter,
      score: result.attempt?.score ?? 0,
      isCorrect: result.isCorrect,
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    if (error instanceof Error) {
      if (error.message === "ATTEMPT_NOT_FOUND") {
        return NextResponse.json({ message: "ไม่พบการทำข้อสอบ" }, { status: 404 });
      }
      if (error.message === "QUESTION_MISMATCH") {
        return NextResponse.json({ message: "ลำดับคำถามไม่ถูกต้อง" }, { status: 409 });
      }
      if (error.message === "QUESTION_NOT_FOUND" || error.message === "CHOICE_NOT_FOUND") {
        return NextResponse.json({ message: "ข้อมูลคำถามไม่ถูกต้อง" }, { status: 404 });
      }
    }
    return NextResponse.json({ message: "ไม่สามารถบันทึกคำตอบได้" }, { status: 500 });
  }
}
