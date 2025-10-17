import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { questionCreateSchema } from "@/lib/validators/question";

const querySchema = z.object({
  search: z.string().optional(),
  subject: z.string().optional(),
  grade: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

const formatQuestion = (question: {
  id: string;
  subject: string;
  gradeLevel: string;
  body: string;
  explanation: string;
  shouldRescore: boolean;
  createdAt: Date;
  updatedAt: Date;
  choices: Array<{ id: string; text: string; isCorrect: boolean; order: number }>;
  aiScores: Array<{ difficulty: number | null }>;
}) => ({
  id: question.id,
  subject: question.subject,
  gradeLevel: question.gradeLevel,
  body: question.body,
  explanation: question.explanation,
  shouldRescore: question.shouldRescore,
  createdAt: question.createdAt,
  updatedAt: question.updatedAt,
  difficulty: question.aiScores[0]?.difficulty ?? null,
  choices: question.choices,
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const userId = session.user.id;

    const url = new URL(request.url);
    const rawParams = {
      search: url.searchParams.get("search") ?? undefined,
      subject: url.searchParams.get("subject") ?? undefined,
      grade: url.searchParams.get("grade") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    };
    const params = querySchema.parse(rawParams);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;

    const where: Prisma.QuestionWhereInput = {
      createdById: userId,
    };

    if (params.subject && params.subject !== "all") {
      where.subject = { equals: params.subject };
    }
    if (params.grade && params.grade !== "all") {
      where.gradeLevel = { equals: params.grade };
    }
    if (params.search) {
      const searchFilter: Prisma.QuestionWhereInput = {
        OR: [
          { subject: { contains: params.search } },
          { gradeLevel: { contains: params.search } },
          { body: { contains: params.search } },
          { explanation: { contains: params.search } },
        ],
      };
      if (where.AND) {
        where.AND = Array.isArray(where.AND)
          ? [...where.AND, searchFilter]
          : [where.AND, searchFilter];
      } else {
        where.AND = [searchFilter];
      }
    }

    const [items, total, subjectGroups, gradeGroups] = await prisma.$transaction([
      prisma.question.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          choices: { orderBy: { order: "asc" } },
          aiScores: { orderBy: { createdAt: "desc" }, take: 1, select: { difficulty: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.question.count({ where }),
      prisma.question.groupBy({
        by: ["subject"],
        where: { createdById: userId },
        orderBy: { subject: "asc" },
      }),
      prisma.question.groupBy({
        by: ["gradeLevel"],
        where: { createdById: userId },
        orderBy: { gradeLevel: "asc" },
      }),
    ]);

    return NextResponse.json({
      data: items.map((question) => formatQuestion(question)),
      page,
      pageSize,
      total,
      subjects: subjectGroups.map((group) => group.subject),
      grades: gradeGroups.map((group) => group.gradeLevel),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "ไม่สามารถดึงข้อมูลคำถามได้" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const parsed = questionCreateSchema.parse(body);
    const shouldRescore = parsed.shouldRescore ?? false;

    const created = await prisma.question.create({
      data: {
        subject: parsed.subject,
        gradeLevel: parsed.gradeLevel,
        body: parsed.body,
        explanation: parsed.explanation,
        shouldRescore,
        createdById: userId,
        choices: {
          create: parsed.choices.map((choice, index) => ({
            text: choice.text,
            isCorrect: choice.isCorrect,
            order: choice.order ?? index,
          })),
        },
      },
      include: {
        choices: { orderBy: { order: "asc" } },
        aiScores: { orderBy: { createdAt: "desc" }, take: 1, select: { difficulty: true } },
      },
    });

    return NextResponse.json({ data: formatQuestion(created) }, { status: 201 });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() },
        { status: 422 },
      );
    }
    return NextResponse.json({ message: "ไม่สามารถสร้างคำถามได้" }, { status: 500 });
  }
}
