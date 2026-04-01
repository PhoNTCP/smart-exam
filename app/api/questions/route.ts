import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { questionCreateSchema } from "@/lib/validators/question";
import {
  accuracyFromStats,
  MIN_RELIABLE_ATTEMPTS,
  PERFORMANCE_DIFFICULTY_MODEL,
} from "@/lib/services/question-difficulty";

const querySchema = z.object({
  search: z.string().optional(),
  subject: z.string().optional(),
  grade: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

type LatestScore = {
  difficulty: number | null;
  reason: string | null;
  modelName: string | null;
};

const formatQuestion = (
  question: {
    id: string;
    subject: string;
    gradeLevel: string;
    body: string;
    explanation: string;
    shouldRescore: boolean;
    createdAt: Date;
    updatedAt: Date;
    choices: Array<{ id: string; text: string; isCorrect: boolean; order: number }>;
    aiScores: LatestScore[];
  },
  stats: {
    totalAttempts: number;
    correctCount: number;
    incorrectCount: number;
    accuracyPercent: number | null;
  },
) => {
  const latestScore = question.aiScores[0];
  const statsBasedDifficulty =
    latestScore?.modelName === PERFORMANCE_DIFFICULTY_MODEL ? latestScore.difficulty ?? null : null;

  return {
    id: question.id,
    subject: question.subject,
    gradeLevel: question.gradeLevel,
    body: question.body,
    explanation: question.explanation,
    shouldRescore: question.shouldRescore,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    difficulty: statsBasedDifficulty,
    difficultySummary: latestScore?.modelName === PERFORMANCE_DIFFICULTY_MODEL ? latestScore.reason ?? null : null,
    difficultySource: latestScore?.modelName === PERFORMANCE_DIFFICULTY_MODEL ? latestScore.modelName : null,
    totalAttempts: stats.totalAttempts,
    correctCount: stats.correctCount,
    incorrectCount: stats.incorrectCount,
    accuracyPercent: stats.accuracyPercent,
    hasReliableStats: stats.totalAttempts >= MIN_RELIABLE_ATTEMPTS,
    choices: question.choices,
  };
};

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
      where.AND = where.AND
        ? Array.isArray(where.AND)
          ? [...where.AND, searchFilter]
          : [where.AND, searchFilter]
        : [searchFilter];
    }

    const [items, total, subjectGroups, gradeGroups] = await prisma.$transaction([
      prisma.question.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          choices: { orderBy: { order: "asc" } },
          aiScores: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { difficulty: true, reason: true, modelName: true },
          },
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

    const questionIds = items.map((item) => item.id);
    const answerGroups =
      questionIds.length > 0
        ? await prisma.attemptAnswer.groupBy({
            by: ["questionId", "isCorrect"],
            where: {
              questionId: { in: questionIds },
            },
            _count: {
              _all: true,
            },
          })
        : [];

    const statsMap = new Map<
      string,
      { totalAttempts: number; correctCount: number; incorrectCount: number; accuracyPercent: number | null }
    >();

    for (const questionId of questionIds) {
      const groups = answerGroups.filter((group) => group.questionId === questionId);
      const correctCount = groups.find((group) => group.isCorrect)?._count._all ?? 0;
      const incorrectCount = groups.find((group) => !group.isCorrect)?._count._all ?? 0;
      const totalAttempts = correctCount + incorrectCount;
      statsMap.set(questionId, {
        totalAttempts,
        correctCount,
        incorrectCount,
        accuracyPercent: totalAttempts > 0 ? accuracyFromStats(correctCount, totalAttempts) : null,
      });
    }

    return NextResponse.json({
      data: items.map((question) =>
        formatQuestion(question, statsMap.get(question.id) ?? {
          totalAttempts: 0,
          correctCount: 0,
          incorrectCount: 0,
          accuracyPercent: null,
        }),
      ),
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
        aiScores: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { difficulty: true, reason: true, modelName: true },
        },
      },
    });

    return NextResponse.json(
      {
        data: formatQuestion(created, {
          totalAttempts: 0,
          correctCount: 0,
          incorrectCount: 0,
          accuracyPercent: null,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ message: "ไม่สามารถสร้างคำถามได้" }, { status: 500 });
  }
}
