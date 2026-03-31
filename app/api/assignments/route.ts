import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createAssignmentSchema = z.object({
  examId: z.string().cuid("รหัสข้อสอบไม่ถูกต้อง"),
  subjectId: z.string().cuid("รหัสวิชาไม่ถูกต้อง"),
  startAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  studentIds: z.array(z.string().cuid()).optional(),
});

const deleteAssignmentSchema = z.object({
  assignmentId: z.string().cuid("รหัสงานที่มอบหมายไม่ถูกต้อง"),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const teacherId = session.user.id;

    const body = await request.json();
    const payload = createAssignmentSchema.parse(body);

    const [subject, exam] = await Promise.all([
      prisma.subject.findFirst({
        where: { id: payload.subjectId, createdById: teacherId },
        select: { id: true },
      }),
      prisma.exam.findFirst({
        where: { id: payload.examId, createdById: teacherId },
        select: { id: true, subjectId: true },
      }),
    ]);

    if (!subject) {
      return NextResponse.json({ message: "ไม่พบวิชา" }, { status: 404 });
    }
    if (!exam) {
      return NextResponse.json({ message: "ไม่พบข้อสอบ" }, { status: 404 });
    }
    if (exam.subjectId !== subject.id) {
      return NextResponse.json({ message: "ข้อสอบนี้ไม่ได้อยู่ในวิชานี้" }, { status: 400 });
    }

    const enrollments = await prisma.subjectEnrollment.findMany({
      where: { subjectId: subject.id },
      select: { userId: true },
    });

    const enrolledStudentIds = new Set(enrollments.map((enrollment) => enrollment.userId));
    const targetStudentIds = payload.studentIds?.length
      ? payload.studentIds.filter((studentId) => enrolledStudentIds.has(studentId))
      : enrollments.map((enrollment) => enrollment.userId);

    if (targetStudentIds.length === 0) {
      return NextResponse.json({ message: "กรุณาเลือกนักเรียนอย่างน้อย 1 คน" }, { status: 400 });
    }

    const startAt = payload.startAt ?? new Date();
    const dueAt = payload.dueAt ?? null;

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.examAssignment.create({
        data: {
          examId: exam.id,
          subjectId: subject.id,
          assignedBy: teacherId,
          startAt,
          dueAt,
        },
      });

      await tx.studentExam.createMany({
        data: targetStudentIds.map((studentId) => ({
          assignmentId: created.id,
          studentId,
        })),
        skipDuplicates: true,
      });

      return created;
    });

    const enriched = await prisma.examAssignment.findUnique({
      where: { id: assignment.id },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
          },
        },
        studentLinks: {
          select: { status: true },
        },
      },
    });

    if (!enriched) {
      return NextResponse.json({ message: "ไม่สามารถสร้างการมอบหมายได้" }, { status: 500 });
    }

    const completedCount = enriched.studentLinks.filter((link) => link.status === "COMPLETED").length;

    return NextResponse.json({
      data: {
        id: enriched.id,
        examId: enriched.examId,
        subjectId: enriched.subjectId,
        examTitle: enriched.exam.title,
        startAt: enriched.startAt,
        dueAt: enriched.dueAt,
        createdAt: enriched.createdAt,
        assignedCount: enriched.studentLinks.length,
        completedCount,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถสร้างการมอบหมายได้" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const teacherId = session.user.id;

    const body = await request.json();
    const payload = deleteAssignmentSchema.parse(body);

    const assignment = await prisma.examAssignment.findFirst({
      where: {
        id: payload.assignmentId,
        assignedBy: teacherId,
      },
      select: {
        id: true,
      },
    });

    if (!assignment) {
      return NextResponse.json({ message: "ไม่พบงานที่มอบหมาย" }, { status: 404 });
    }

    await prisma.examAssignment.delete({
      where: { id: assignment.id },
    });

    return NextResponse.json({ message: "ลบงานที่มอบหมายเรียบร้อย" });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถลบงานที่มอบหมายได้" }, { status: 500 });
  }
}
