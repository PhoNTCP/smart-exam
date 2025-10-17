import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCurrentQuestion, ADAPTIVE_TOTAL, toThetaNumber } from "@/lib/services/adaptive-engine";

const bodySchema = z.object({
  studentExamId: z.string().cuid(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "student" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { studentExamId } = bodySchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const link = await tx.studentExam.findFirst({
        where: { id: studentExamId, studentId: session.user!.id },
        include: {
          assignment: {
            include: {
              exam: {
                include: {
                  subjectRef: true,
                },
              },
              subject: true,
            },
          },
        },
      });

      if (!link) {
        throw new Error("STUDENT_EXAM_NOT_FOUND");
      }

      if (link.status === "COMPLETED") {
        throw new Error("ASSIGNMENT_ALREADY_COMPLETED");
      }

      const subject = link.assignment.subject;
      const teacherId = link.assignment.exam.createdById;
      const availableQuestions = await tx.question.count({
        where: {
          createdById: teacherId,
          ...(subject?.name ? { subject: subject.name } : {}),
        },
      });

      if (availableQuestions === 0) {
        throw new Error("NO_QUESTIONS_AVAILABLE");
      }

      let attemptId = link.attemptId;
      if (!attemptId) {
        const initialTheta = 0.5;
        const attempt = await tx.examAttempt.create({
          data: {
            examId: link.assignment.examId,
            userId: session.user!.id,
            thetaStart: new Prisma.Decimal(initialTheta.toFixed(2)),
            thetaEnd: new Prisma.Decimal(initialTheta.toFixed(2)),
            score: 0,
          },
        });
        attemptId = attempt.id;
      }

      await tx.studentExam.update({
        where: { id: link.id },
        data: {
          status: "IN_PROGRESS",
          attemptId,
        },
      });

      return {
        assignment: link.assignment,
        attemptId,
      };
    });

    const assignment = result.assignment;
    const attemptId = result.attemptId;

    const next = await ensureCurrentQuestion(attemptId, session.user.id);
    if (!next) {
      return NextResponse.json({ message: "ไม่พบข้อมูลข้อสอบ" }, { status: 404 });
    }

    if (next.status === "completed") {
      return NextResponse.json({
        attemptId,
        exam: {
          id: assignment.exam.id,
          title: assignment.exam.title,
          subject: assignment.exam.subjectRef?.name ?? "",
          subjectCode: assignment.exam.subjectRef?.code ?? "",
        },
        status: "completed",
        summary: {
          answered: next.answeredCount,
          total: ADAPTIVE_TOTAL,
          theta: toThetaNumber(next.attempt.thetaEnd),
          score: next.attempt.score,
        },
      });
    }

    return NextResponse.json({
      attemptId,
      exam: {
        id: assignment.exam.id,
        title: assignment.exam.title,
        subject: assignment.exam.subjectRef?.name ?? "",
        subjectCode: assignment.exam.subjectRef?.code ?? "",
      },
      question: next.question,
      theta: toThetaNumber(next.attempt.thetaEnd ?? next.attempt.thetaStart),
      answeredCount: next.answeredCount,
      total: ADAPTIVE_TOTAL,
      score: next.attempt.score,
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    if (error instanceof Error) {
      if (error.message === "STUDENT_EXAM_NOT_FOUND") {
        return NextResponse.json({ message: "ไม่พบการมอบหมาย" }, { status: 404 });
      }
      if (error.message === "ASSIGNMENT_ALREADY_COMPLETED") {
        return NextResponse.json({ message: "งานนี้ทำเสร็จแล้ว" }, { status: 409 });
      }
      if (error.message === "NO_QUESTIONS_AVAILABLE") {
        return NextResponse.json(
          {
            message: "ยังไม่มีคำถามในวิชานี้ กรุณาเพิ่มคำถามสำหรับวิชานี้ก่อนมอบหมายข้อสอบ",
          },
          { status: 400 },
        );
      }
    }
    return NextResponse.json({ message: "ไม่สามารถเริ่มทำข้อสอบได้" }, { status: 500 });
  }
}
