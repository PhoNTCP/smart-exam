import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "student" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const links = await prisma.studentExam.findMany({
      where: { studentId: session.user.id },
      include: {
        attempt: {
          select: {
            score: true,
          },
        },
        assignment: {
          include: {
            exam: {
              select: { id: true, title: true, questionCount: true },
            },
            subject: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return NextResponse.json({
      data: links.map((link) => ({
        studentExamId: link.id,
        status: link.status,
        assignedAt: link.assignedAt,
        completedAt: link.completedAt,
        attemptId: link.attemptId,
        score: link.attempt?.score ?? null,
        exam: {
          id: link.assignment.exam.id,
          title: link.assignment.exam.title,
          questionCount: link.assignment.exam.questionCount,
        },
        subject: {
          id: link.assignment.subject.id,
          name: link.assignment.subject.name,
          code: link.assignment.subject.code,
        },
        startAt: link.assignment.startAt,
        dueAt: link.assignment.dueAt,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "ไม่สามารถดึงงานที่ได้รับได้" }, { status: 500 });
  }
}
