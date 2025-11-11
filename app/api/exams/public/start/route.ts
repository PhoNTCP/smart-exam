import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCurrentQuestion, toThetaNumber } from "@/lib/services/adaptive-engine";
import { ensureStandardExamQuestions, StandardExamQuestionError } from "@/lib/services/exam-questions";

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
      where: { id: examId, isPublic: true },
      include: {
        subjectRef: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ message: "ไม่พบข้อสอบสาธารณะ" }, { status: 404 });
    }

    if (!exam.subjectRef) {
      return NextResponse.json({ message: "ข้อสอบนี้ยังไม่ได้กำหนดวิชา" }, { status: 400 });
    }

    if (exam.isAdaptive) {
      const availableQuestions = await prisma.question.count({
        where: {
          createdById: exam.createdById,
          ...(exam.subjectRef.name ? { subject: exam.subjectRef.name } : {}),
        },
      });

      if (availableQuestions === 0) {
        return NextResponse.json(
          { message: "ยังไม่มีคำถามในวิชานี้สำหรับข้อสอบ Adaptive" },
          { status: 400 },
        );
      }
    } else {
      await ensureStandardExamQuestions(
        prisma,
        {
          examId: exam.id,
          teacherId: exam.createdById,
          subjectName: exam.subjectRef.name,
          questionCount: exam.questionCount,
        },
        { force: true },
      );
    }

    const existing = await prisma.examAttempt.findFirst({
      where: {
        examId: exam.id,
        userId: session.user.id,
        finishedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      const resume = await ensureCurrentQuestion(existing.id, session.user.id);
      if (!resume) {
        return NextResponse.json({ message: "ไม่พบข้อมูลข้อสอบ" }, { status: 404 });
      }

      const attemptSnapshot = resume.attempt;
      const thetaResume = exam.isAdaptive
        ? toThetaNumber(attemptSnapshot.thetaEnd ?? attemptSnapshot.thetaStart)
        : null;

      if (resume.status === "completed" || !resume.question) {
        return NextResponse.json({
          attemptId: existing.id,
          status: "completed",
          exam: {
            id: exam.id,
            title: exam.title,
            subject: exam.subjectRef.name,
            subjectCode: exam.subjectRef.code,
          },
          summary: {
            answered: resume.answeredCount,
            total: resume.totalQuestions,
            theta: thetaResume,
            score: attemptSnapshot.score,
          },
        });
      }

      return NextResponse.json({
        attemptId: existing.id,
        status: "in-progress",
        exam: {
          id: exam.id,
          title: exam.title,
          subject: exam.subjectRef.name,
          subjectCode: exam.subjectRef.code,
        },
        question: resume.question,
        answeredCount: resume.answeredCount,
        total: resume.totalQuestions,
        theta: thetaResume,
        score: attemptSnapshot.score,
      });
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
            total: assignment.totalQuestions,
            answered: assignment.answeredCount,
            theta: exam.isAdaptive ? initialTheta : null,
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
        subject: exam.subjectRef.name,
        subjectCode: exam.subjectRef.code,
      },
      question: assignment.question,
      theta: exam.isAdaptive ? toThetaNumber(attempt.thetaEnd) : null,
      answeredCount: assignment.answeredCount,
      total: assignment.totalQuestions,
      score: attempt.score,
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    if (error instanceof StandardExamQuestionError) {
      return NextResponse.json(
        {
          message: `ข้อสอบ Standard ต้องการอย่างน้อย ${error.required} ข้อ แต่มีเพียง ${error.available} ข้อ`,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "ไม่สามารถเริ่มข้อสอบได้" }, { status: 500 });
  }
}
