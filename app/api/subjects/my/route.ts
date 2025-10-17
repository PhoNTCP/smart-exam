import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const subjects = await prisma.subject.findMany({
      where: { createdById: session.user.id },
      include: {
        _count: {
          select: {
            exams: true,
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: subjects.map((subject) => ({
        id: subject.id,
        code: subject.code,
        name: subject.name,
        level: subject.level,
        createdAt: subject.createdAt,
        examCount: subject._count.exams,
        studentCount: subject._count.enrollments,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "ไม่สามารถดึงข้อมูลวิชาได้" }, { status: 500 });
  }
}
