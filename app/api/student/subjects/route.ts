import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "student" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const enrollments = await prisma.subjectEnrollment.findMany({
      where: { userId: session.user.id },
      include: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            level: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: enrollments.map((enrollment) => ({
        subjectId: enrollment.subject.id,
        code: enrollment.subject.code,
        name: enrollment.subject.name,
        level: enrollment.subject.level,
        joinedAt: enrollment.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "ไม่สามารถดึงรายวิชาได้" }, { status: 500 });
  }
}
