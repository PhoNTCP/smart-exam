import { prisma } from "@/lib/prisma";
import { authGuard } from "@/lib/auth-guard";
import { StudentProgressDashboard } from "@/components/student/progress-dashboard";

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number(value as unknown as string);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export default async function StudentProgressPage() {
  const user = await authGuard("student");

  const attempts = await prisma.examAttempt.findMany({
    where: { userId: user.id },
    include: {
      exam: true,
      answers: {
        include: {
          question: {
            include: {
              aiScores: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 25,
  });

  const totalAttempts = attempts.length;
  const completedAttempts = attempts.filter((attempt) => Boolean(attempt.finishedAt)).length;

  const latestAttempt = attempts[0]
    ? {
        examTitle: attempts[0].exam.title,
        finishedAt: attempts[0].finishedAt?.toISOString() ?? null,
        startedAt: attempts[0].startedAt.toISOString(),
        score: attempts[0].score,
        thetaStart: toNumber(attempts[0].thetaStart),
        thetaEnd: toNumber(attempts[0].thetaEnd),
        answered: attempts[0].answers.length,
        averageDifficulty:
          attempts[0].answers.length > 0
            ? attempts[0].answers.reduce((sum, answer) => {
                const difficulty = answer.question.aiScores[0]?.difficulty ?? 3;
                return sum + difficulty;
              }, 0) / attempts[0].answers.length
            : null,
        isAdaptive: attempts[0].exam.isAdaptive,
      }
    : null;

  const chartData = [...attempts]
    .reverse()
    .map((attempt, index) => {
      const averageDifficulty =
        attempt.answers.length > 0
          ? attempt.answers.reduce((sum, answer) => {
              const difficulty = answer.question.aiScores[0]?.difficulty ?? 3;
              return sum + difficulty;
            }, 0) / attempt.answers.length
          : null;
      return {
        id: attempt.id,
        label: `ครั้งที่ ${index + 1}`,
        score: attempt.score,
        averageDifficulty,
        thetaEnd: toNumber(attempt.thetaEnd),
        startedAt: attempt.startedAt.toISOString(),
      };
    });

  const totals = attempts.reduce(
    (acc, attempt) => {
      acc.totalAnswered += attempt.answers.length;
      const difficultySum = attempt.answers.reduce((sum, answer) => {
        const difficulty = answer.question.aiScores[0]?.difficulty ?? 3;
        return sum + difficulty;
      }, 0);
      acc.totalDifficulty += difficultySum;
      return acc;
    },
    { totalAnswered: 0, totalDifficulty: 0 },
  );

  const averageDifficultyEncountered =
    totals.totalAnswered > 0 ? totals.totalDifficulty / totals.totalAnswered : null;

  const attemptCards = attempts.map((attempt) => ({
    id: attempt.id,
    examTitle: attempt.exam.title,
    status: attempt.finishedAt ? ("completed" as const) : ("in-progress" as const),
    score: attempt.score,
    thetaStart: toNumber(attempt.thetaStart),
    thetaEnd: toNumber(attempt.thetaEnd),
    updatedAt: (attempt.finishedAt ?? attempt.startedAt).toISOString(),
    answered: attempt.answers.length,
    isAdaptive: attempt.exam.isAdaptive,
  }));

  return (
    <StudentProgressDashboard
      data={{
        summary: {
          totalAttempts,
          completedAttempts,
          averageDifficultyEncountered,
        },
        latestAttempt,
        chartData,
        attempts: attemptCards,
      }}
    />
  );
}
