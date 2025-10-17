import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId") ?? undefined;

    const assignments = await prisma.examAssignment.findMany({
      where: {
        assignedBy: session.user.id,
        ...(subjectId ? { subjectId } : {}),
      },
      include: {
        exam: {
          select: { id: true, title: true },
        },
        subject: {
          select: { id: true, name: true, code: true },
        },
        studentLinks: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: assignments.map((assignment) => {
        const completedCount = assignment.studentLinks.filter((link) => link.status === "COMPLETED").length;
        return {
          id: assignment.id,
          examId: assignment.examId,
          subjectId: assignment.subjectId,
          examTitle: assignment.exam.title,
          subjectName: assignment.subject.name,
          subjectCode: assignment.subject.code,
          startAt: assignment.startAt,
          dueAt: assignment.dueAt,
          createdAt: assignment.createdAt,
          assignedCount: assignment.studentLinks.length,
          completedCount,
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "ไม่สามารถดึงข้อมูลการมอบหมายได้" }, { status: 500 });
  }
}
