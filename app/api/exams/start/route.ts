import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCurrentQuestion, toThetaNumber } from "@/lib/services/adaptive-engine";

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
        questionCount: true,
        difficultyMin: true,
        difficultyMax: true,
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

    const availableQuestions = await prisma.question.count({
      where: {
        createdById: exam.createdById,
        ...(subject.name ? { subject: subject.name } : {}),
      },
    });
    if (availableQuestions === 0) {
      return NextResponse.json(
        {
          message:
            "ยังไม่มีคำถามในวิชานี้ กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อในวิชาเดียวกันก่อนเริ่มทำข้อสอบ",
        },
        { status: 400 },
      );
    }

    const enrolled = await prisma.subjectEnrollment.findFirst({
      where: { subjectId: subject.id, userId: session.user.id },
      select: { id: true },
    });
    if (!enrolled) {
      return NextResponse.json({ message: "คุณยังไม่ได้ลงทะเบียนในวิชานี้" }, { status: 403 });
    }

    const assigned = await prisma.studentExam.findFirst({
      where: {
        studentId: session.user.id,
        assignment: {
          examId: exam.id,
        },
      },
      select: { id: true },
    });
    if (!assigned) {
      return NextResponse.json({ message: "ข้อสอบนี้ยังไม่ได้มอบหมายให้คุณ" }, { status: 403 });
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
      const resume = await ensureCurrentQuestion(existing.id, session.user.id);
      if (!resume) {
        return NextResponse.json({ message: "ไม่พบการทำข้อสอบเดิม" }, { status: 404 });
      }

      const attemptSnapshot = resume.attempt;
      const thetaResume = toThetaNumber(attemptSnapshot.thetaEnd ?? attemptSnapshot.thetaStart);

      if (resume.status === "completed" || !resume.question) {
        return NextResponse.json({
          attemptId: existing.id,
          status: "completed",
          exam: {
            id: exam.id,
            title: exam.title,
            subject: subject.name,
            subjectCode: subject.code,
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
          subject: subject.name,
          subjectCode: subject.code,
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
      total: assignment.totalQuestions,
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
