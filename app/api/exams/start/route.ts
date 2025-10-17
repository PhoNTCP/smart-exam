import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCurrentQuestion, ADAPTIVE_TOTAL, toThetaNumber } from "@/lib/services/adaptive-engine";

const bodySchema = z.object({
  examId: z.string().cuid(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "student" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { examId } = bodySchema.parse(body);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, isAdaptive: true },
      select: {
        id: true,
        title: true,
        subjectRef: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdById: true,
      },
    });
    if (!exam) {
      return NextResponse.json({ message: "ไม่พบข้อสอบ" }, { status: 404 });
    }

    const subject = exam.subjectRef;
    if (!subject) {
      return NextResponse.json({ message: "ข้อสอบนี้ยังไม่ได้แนบกับวิชา" }, { status: 400 });
    }

    const enrolled = await prisma.subjectEnrollment.findFirst({
      where: { subjectId: subject.id, userId: session.user.id },
      select: { id: true },
    });
    if (!enrolled) {
      return NextResponse.json({ message: "คุณยังไม่ได้ลงทะเบียนในวิชานี้" }, { status: 403 });
    }

    const existing = await prisma.examAttempt.findFirst({
      where: {
        examId,
        userId: session.user.id,
        finishedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ message: "คุณมีการทำข้อสอบนี้ค้างอยู่" }, { status: 409 });
    }

    const initialTheta = 0.5;
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        userId: session.user.id,
        thetaStart: new Prisma.Decimal(initialTheta.toFixed(2)),
        thetaEnd: new Prisma.Decimal(initialTheta.toFixed(2)),
        score: 0,
      },
    });

    const assignment = await ensureCurrentQuestion(attempt.id, session.user.id);
    if (!assignment) {
      return NextResponse.json({ message: "ไม่สามารถเริ่มข้อสอบได้" }, { status: 400 });
    }

    if (!assignment.question) {
      return NextResponse.json(
        {
          attemptId: attempt.id,
          status: "completed",
          summary: {
            score: 0,
            total: ADAPTIVE_TOTAL,
            answered: assignment.answeredCount,
            theta: initialTheta,
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      attemptId: attempt.id,
      exam: {
        id: exam.id,
        title: exam.title,
        subject: subject.name,
        subjectCode: subject.code,
      },
      question: assignment.question,
      theta: toThetaNumber(attempt.thetaEnd),
      answeredCount: assignment.answeredCount,
      total: ADAPTIVE_TOTAL,
      score: attempt.score,
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถเริ่มข้อสอบได้" }, { status: 500 });
  }
}
