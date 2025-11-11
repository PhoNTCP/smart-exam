import { Prisma, PrismaClient } from "@prisma/client";

type PrismaExecutor = Prisma.TransactionClient | PrismaClient;

type EnsureParams = {
  examId: string;
  teacherId: string;
  subjectName?: string | null;
  questionCount: number;
};

export class StandardExamQuestionError extends Error {
  constructor(
    public required: number,
    public available: number,
  ) {
    super("STANDARD_NOT_ENOUGH_QUESTIONS");
    this.name = "StandardExamQuestionError";
  }
}

const questionOrderBy: Prisma.QuestionOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" },
];

const buildQuestionWhere = (params: EnsureParams): Prisma.QuestionWhereInput => {
  const where: Prisma.QuestionWhereInput = {
    createdById: params.teacherId,
  };
  if (params.subjectName) {
    where.subject = params.subjectName;
  }
  return where;
};

/**
 * Ensure that a Standard exam has a deterministic set of questions.
 * When `force` is true we always rebuild the linkage, otherwise we only rebuild
 * when there are not enough linked questions yet.
 */
export const ensureStandardExamQuestions = async (
  db: PrismaExecutor,
  params: EnsureParams,
  options: { force?: boolean } = {},
) => {
  const where = buildQuestionWhere(params);
  const required = Math.max(1, params.questionCount);

  const currentLinks = await db.examQuestion.count({
    where: { examId: params.examId },
  });
  if (!options.force && currentLinks >= required) {
    return currentLinks;
  }

  const available = await db.question.count({ where });
  if (available < required) {
    throw new StandardExamQuestionError(required, available);
  }

  const questions = await db.question.findMany({
    where,
    orderBy: questionOrderBy,
    take: required,
    select: { id: true },
  });

  await db.examQuestion.deleteMany({
    where: { examId: params.examId },
  });

  if (questions.length === 0) {
    throw new StandardExamQuestionError(required, 0);
  }

  await db.examQuestion.createMany({
    data: questions.map((question, index) => ({
      examId: params.examId,
      questionId: question.id,
      order: index,
    })),
  });

  return required;
};
