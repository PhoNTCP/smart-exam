import { prisma } from "@/lib/prisma";
import { authGuard } from "@/lib/auth-guard";
import { TeacherReportsDashboard } from "@/components/teacher/reports-dashboard";

const toDurationMs = (startedAt: Date, finishedAt?: Date | null) => {
  const end = finishedAt ?? new Date();
  return Math.max(0, end.getTime() - startedAt.getTime());
};

export default async function TeacherReportsPage() {
  const user = await authGuard("teacher");

  const attempts = await prisma.examAttempt.findMany({
    where: { exam: { createdById: user.id } },
    include: {
      exam: {
        include: {
          subjectRef: true,
        },
      },
      user: true,
      answers: true,
    },
    orderBy: { startedAt: "desc" },
    take: 300,
  });

  const subjects = Array.from(
    new Set(
      attempts
        .map((attempt) => attempt.exam.subjectRef?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort();

  const dataset = attempts.map((attempt) => ({
    attemptId: attempt.id,
    studentId: attempt.user.id,
    studentName: attempt.user.name ?? undefined,
    studentEmail: attempt.user.email,
    subject: attempt.exam.subjectRef?.name ?? "ไม่ระบุ",
    subjectCode: attempt.exam.subjectRef?.code ?? "",
    examTitle: attempt.exam.title,
    score: attempt.score,
    answerCount: attempt.answers.length,
    startedAt: attempt.startedAt.toISOString(),
    finishedAt: attempt.finishedAt?.toISOString() ?? null,
    durationMs: attempt.answers.length > 0 ? toDurationMs(attempt.startedAt, attempt.finishedAt) : null,
  }));

  return (
    <TeacherReportsDashboard
      data={{
        attempts: dataset,
        subjects,
      }}
    />
  );
}
