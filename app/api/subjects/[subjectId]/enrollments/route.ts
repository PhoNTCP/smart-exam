import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{
    subjectId: string;
  }>;
};

const enrollSchema = z.object({
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง"),
});

const removeSchema = z.object({
  userId: z.string().cuid("รหัสนักเรียนไม่ถูกต้อง"),
});

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { subjectId } = await params;
    const body = await request.json();
    const payload = enrollSchema.parse(body);

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, createdById: session.user.id },
      select: { id: true },
    });
    if (!subject) {
      return NextResponse.json({ message: "ไม่พบวิชา" }, { status: 404 });
    }

    const student = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      select: { id: true, role: true, name: true, email: true },
    });
    if (!student || student.role !== "student") {
      return NextResponse.json({ message: "ไม่พบนักเรียนด้วยอีเมลนี้" }, { status: 404 });
    }

    const enrollment = await prisma.subjectEnrollment.create({
      data: {
        subjectId: subject.id,
        userId: student.id,
      },
      include: {
        student: true,
      },
    });

    return NextResponse.json({
      data: {
        id: enrollment.id,
        userId: enrollment.userId,
        name: enrollment.student.name,
        email: enrollment.student.email,
        createdAt: enrollment.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "นักเรียนคนนี้ถูกเพิ่มในวิชานี้อยู่แล้ว" }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถเพิ่มนักเรียนได้" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { subjectId } = await params;
    const body = await request.json();
    const payload = removeSchema.parse(body);

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, createdById: session.user.id },
      select: { id: true },
    });
    if (!subject) {
      return NextResponse.json({ message: "ไม่พบวิชา" }, { status: 404 });
    }

    await prisma.subjectEnrollment.deleteMany({
      where: {
        subjectId: subject.id,
        userId: payload.userId,
      },
    });

    return NextResponse.json({ message: "ลบนักเรียนออกจากวิชาเรียบร้อย" });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถลบนักเรียนได้" }, { status: 500 });
  }
}
