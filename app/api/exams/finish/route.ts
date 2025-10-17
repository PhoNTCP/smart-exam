import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { finishAttempt, formatAttemptSummary } from "@/lib/services/adaptive-engine";

const bodySchema = z.object({
  attemptId: z.string().cuid(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "student" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { attemptId } = bodySchema.parse(body);

    const attempt = await finishAttempt(attemptId, session.user.id);
    if (!attempt) {
      return NextResponse.json({ message: "ไม่พบการทำข้อสอบ" }, { status: 404 });
    }

    await prisma.studentExam.updateMany({
      where: { attemptId: attempt.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      status: "completed",
      summary: formatAttemptSummary(attempt),
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    if (error instanceof Error && error.message === "ATTEMPT_NOT_FOUND") {
      return NextResponse.json({ message: "ไม่พบการทำข้อสอบ" }, { status: 404 });
    }
    return NextResponse.json({ message: "ไม่สามารถปิดการทำข้อสอบได้" }, { status: 500 });
  }
}
