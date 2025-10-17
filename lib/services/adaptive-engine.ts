import { Prisma, Question } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TOTAL_QUESTIONS = 10;

const clampTheta = (value: number) => Number(Math.min(1, Math.max(0, value)).toFixed(2));

const difficultyFromTheta = (theta: number) => {
  const raw = Math.round(theta * 4) + 1;
  return Math.min(5, Math.max(1, raw));
};

const latestDifficulty = (
  question: Question & { aiScores: Array<{ difficulty: number | null; reason: string }> },
) => question.aiScores[0]?.difficulty ?? 3;

const latestReason = (
  question: Question & { aiScores: Array<{ difficulty: number | null; reason: string }> },
) => question.aiScores[0]?.reason ?? "AI rationale unavailable";

const serializeQuestion = (
  question: Question & {
    aiScores: Array<{ difficulty: number | null; reason: string }>;
    choices: Array<{ id: string; text: string; isCorrect: boolean; order: number }>;
  },
) => ({
  id: question.id,
  subject: question.subject,
  gradeLevel: question.gradeLevel,
  body: question.body,
  explanation: question.explanation,
  difficulty: latestDifficulty(question),
  hint: latestReason(question),
  choices: question.choices
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((choice) => ({
      id: choice.id,
      text: choice.text,
    })),
});

type SerializedQuestion = ReturnType<typeof serializeQuestion>;
type AttemptContext = Awaited<ReturnType<typeof fetchAttemptContext>>;

const fetchAttemptContext = async (
  tx: Prisma.TransactionClient,
  attemptId: string,
  userId: string,
) => {
  return tx.examAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      exam: {
        include: {
          subjectRef: true,
        },
      },
      currentQuestion: {
        include: {
          choices: true,
          aiScores: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      answers: {
        select: { id: true, questionId: true, isCorrect: true },
      },
    },
  });
};

const selectNextQuestion = async (
  tx: Prisma.TransactionClient,
  context: NonNullable<AttemptContext>,
) => {
  const theta = Number(context.thetaEnd ?? context.thetaStart) || 0.5;
  const targetDifficulty = difficultyFromTheta(theta);
  const excludeIds = [
    ...context.answers.map((answer) => answer.questionId),
    ...(context.currentQuestionId ? [context.currentQuestionId] : []),
  ];

  const subjectName = context.exam.subjectRef?.name;
  const questionWhere: Prisma.QuestionWhereInput = {
    createdById: context.exam.createdById,
    id: { notIn: excludeIds },
  };

  if (subjectName) {
    questionWhere.subject = subjectName;
  }

  const candidates = await tx.question.findMany({
    where: questionWhere,
    include: {
      choices: true,
      aiScores: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    take: 25,
  });

  if (candidates.length === 0) {
    return null;
  }

  const ranked = candidates
    .map((question) => ({
      question,
      diff: Math.abs((question.aiScores[0]?.difficulty ?? 3) - targetDifficulty),
    }))
    .sort((a, b) => a.diff - b.diff);

  return ranked[0]?.question ?? null;
};

type EnsureResult =
  | {
      status: "completed";
      attempt: NonNullable<AttemptContext>;
      question: null;
      answeredCount: number;
    }
  | {
      status: "in-progress";
      attempt: NonNullable<AttemptContext>;
      question: SerializedQuestion;
      answeredCount: number;
    };

export const ensureCurrentQuestion = async (
  attemptId: string,
  userId: string,
): Promise<EnsureResult | null> => {
  return prisma.$transaction(async (tx) => {
    const attempt = await fetchAttemptContext(tx, attemptId, userId);
    if (!attempt) {
      return null;
    }

    const answeredCount = attempt.answers.length;
    const finished = Boolean(attempt.finishedAt) || answeredCount >= TOTAL_QUESTIONS;

    if (finished) {
      const completedAttempt =
        attempt.finishedAt !== null
          ? attempt
          : await tx.examAttempt.update({
              where: { id: attempt.id },
              data: {
                finishedAt: new Date(),
                currentQuestionId: null,
              },
              include: {
                exam: {
                  include: {
                    subjectRef: true,
                  },
                },
                currentQuestion: {
                  include: {
                    choices: true,
                    aiScores: { orderBy: { createdAt: "desc" }, take: 1 },
                  },
                },
                answers: {
                  select: { id: true, questionId: true, isCorrect: true },
                },
              },
            });

      return {
        status: "completed",
        attempt: completedAttempt,
        question: null,
        answeredCount,
      };
    }

    if (attempt.currentQuestion) {
      return {
        status: "in-progress",
        attempt,
        question: serializeQuestion(attempt.currentQuestion),
        answeredCount,
      };
    }

    const nextQuestion = await selectNextQuestion(tx, attempt);
    if (!nextQuestion) {
      const completedAttempt = await tx.examAttempt.update({
        where: { id: attempt.id },
        data: {
          finishedAt: new Date(),
          currentQuestionId: null,
        },
        include: {
          exam: {
            include: {
              subjectRef: true,
            },
          },
          currentQuestion: {
            include: {
              choices: true,
              aiScores: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
          answers: {
            select: { id: true, questionId: true, isCorrect: true },
          },
        },
      });

      return {
        status: "completed",
        attempt: completedAttempt,
        question: null,
        answeredCount,
      };
    }

    await tx.examAttempt.update({
      where: { id: attempt.id },
      data: {
        currentQuestionId: nextQuestion.id,
      },
    });

    const refreshed = await fetchAttemptContext(tx, attempt.id, userId);
    if (!refreshed || !refreshed.currentQuestion) {
      throw new Error("NEXT_QUESTION_ASSIGNMENT_FAILED");
    }

    return {
      status: "in-progress",
      attempt: refreshed,
      question: serializeQuestion(refreshed.currentQuestion),
      answeredCount: refreshed.answers.length,
    };
  });
};

const computeThetaDelta = (isCorrect: boolean, difficulty: number) => {
  const baseStep = 0.18;
  const difficultyFactor = (difficulty - 3) * 0.05;
  return isCorrect ? baseStep - difficultyFactor : -(baseStep + difficultyFactor);
};

type RecordAnswerInput = {
  attemptId: string;
  userId: string;
  questionId: string;
  choiceId: string;
};

export const finishAttempt = async (attemptId: string, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const attempt = await fetchAttemptContext(tx, attemptId, userId);
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }
    if (attempt.finishedAt) {
      const existing = await tx.examAttempt.findFirst({
        where: { id: attempt.id },
        include: {
          answers: true,
        },
      });
      if (!existing) {
        throw new Error("ATTEMPT_NOT_FOUND");
      }
      return existing;
    }

    return tx.examAttempt.update({
      where: { id: attempt.id },
      data: {
        finishedAt: new Date(),
        currentQuestionId: null,
      },
      include: {
        answers: true,
      },
    });
  });
};

type FinishedAttempt = Awaited<ReturnType<typeof finishAttempt>>;

type RecordAnswerResult =
  | {
      status: "completed";
      attempt: FinishedAttempt;
      question: null;
      answeredCount: number;
      thetaAfter: number;
      isCorrect: boolean;
    }
  | {
      status: "in-progress";
      attempt: NonNullable<AttemptContext>;
      question: SerializedQuestion;
      answeredCount: number;
      thetaAfter: number;
      isCorrect: boolean;
    };

export const recordAnswer = async (input: RecordAnswerInput): Promise<RecordAnswerResult> => {
  return prisma.$transaction(async (tx) => {
    const attempt = await fetchAttemptContext(tx, input.attemptId, input.userId);
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }
    if (attempt.finishedAt) {
      throw new Error("ATTEMPT_ALREADY_FINISHED");
    }
    if (!attempt.currentQuestion || attempt.currentQuestion.id !== input.questionId) {
      throw new Error("QUESTION_MISMATCH");
    }

    const selectedChoice = attempt.currentQuestion.choices.find(
      (choice) => choice.id === input.choiceId,
    );
    if (!selectedChoice) {
      throw new Error("CHOICE_NOT_FOUND");
    }

    const isCorrect = selectedChoice.isCorrect;
    const thetaBefore = Number(attempt.thetaEnd ?? attempt.thetaStart) || 0.5;
    const difficulty = latestDifficulty(attempt.currentQuestion);
    const thetaAfter = clampTheta(thetaBefore + computeThetaDelta(isCorrect, difficulty));

    await tx.attemptAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: attempt.currentQuestion.id,
        choiceId: selectedChoice.id,
        isCorrect,
        thetaBefore: new Prisma.Decimal(thetaBefore.toFixed(2)),
        thetaAfter: new Prisma.Decimal(thetaAfter.toFixed(2)),
      },
    });

    await tx.examAttempt.update({
      where: { id: attempt.id },
      data: {
        thetaEnd: new Prisma.Decimal(thetaAfter.toFixed(2)),
        currentQuestionId: null,
        score: attempt.score + (isCorrect ? 1 : 0),
      },
    });

    const updated = await fetchAttemptContext(tx, attempt.id, input.userId);
    if (!updated) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }

    const answeredCount = updated.answers.length;
    const finished = answeredCount >= TOTAL_QUESTIONS;

    if (finished) {
      const finishedAttempt = await tx.examAttempt.update({
        where: { id: attempt.id },
        data: {
          finishedAt: new Date(),
          currentQuestionId: null,
        },
        include: {
          answers: true,
        },
      });

      return {
        status: "completed",
        attempt: finishedAttempt,
        question: null,
        answeredCount,
        thetaAfter,
        isCorrect,
      };
    }

    const nextQuestion = await selectNextQuestion(tx, updated);
    if (!nextQuestion) {
      const finishedAttempt = await tx.examAttempt.update({
        where: { id: attempt.id },
        data: {
          finishedAt: new Date(),
          currentQuestionId: null,
        },
        include: {
          answers: true,
        },
      });

      return {
        status: "completed",
        attempt: finishedAttempt,
        question: null,
        answeredCount,
        thetaAfter,
        isCorrect,
      };
    }

    await tx.examAttempt.update({
      where: { id: attempt.id },
      data: {
        currentQuestionId: nextQuestion.id,
      },
    });

    const refreshed = await fetchAttemptContext(tx, attempt.id, input.userId);
    if (!refreshed || !refreshed.currentQuestion) {
      throw new Error("NEXT_QUESTION_ASSIGNMENT_FAILED");
    }

    return {
      status: "in-progress",
      attempt: refreshed,
      question: serializeQuestion(refreshed.currentQuestion),
      answeredCount: refreshed.answers.length,
      thetaAfter,
      isCorrect,
    };
  });
};

export const formatAttemptSummary = (attempt: Awaited<ReturnType<typeof finishAttempt>>) => ({
  attemptId: attempt.id,
  score: attempt.score,
  total: TOTAL_QUESTIONS,
  thetaStart: Number(attempt.thetaStart),
  thetaEnd: Number(attempt.thetaEnd),
  answered: attempt.answers.length,
  finishedAt: attempt.finishedAt ?? new Date(),
});

export const ADAPTIVE_TOTAL = TOTAL_QUESTIONS;
export const toThetaNumber = (value: Prisma.Decimal | number) => Number(value);

export { difficultyFromTheta };
