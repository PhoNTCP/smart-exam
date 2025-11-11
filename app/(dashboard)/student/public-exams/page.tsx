import { authGuard } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PublicExamBrowser } from "@/components/student/public-exam-browser";

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default async function StudentPublicExamsPage() {
  const user = await authGuard("student");

  const exams = await prisma.exam.findMany({
    where: { isPublic: true },
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
      subjectRef: {
        select: {
          name: true,
          code: true,
        },
      },
      attempts: {
        where: { userId: user.id },
        orderBy: { startedAt: "desc" },
        include: {
          _count: {
            select: { answers: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = exams.map((exam) => ({
    id: exam.id,
    title: exam.title,
    subjectName: exam.subjectRef?.name ?? "ไม่ระบุวิชา",
    subjectCode: exam.subjectRef?.code ?? "-",
    isAdaptive: exam.isAdaptive,
    isPublic: exam.isPublic,
    teacherName: exam.createdBy?.name ?? exam.createdBy?.email ?? "ไม่ระบุ",
    questionCount: exam.questionCount,
    difficultyMin: exam.difficultyMin,
    difficultyMax: exam.difficultyMax,
    attempts: exam.attempts.map((attempt) => ({
      id: attempt.id,
      startedAt: attempt.startedAt.toISOString(),
      finishedAt: attempt.finishedAt ? attempt.finishedAt.toISOString() : null,
      thetaStart: toNumber(attempt.thetaStart),
      thetaEnd: toNumber(attempt.thetaEnd),
      score: attempt.score,
      answered: attempt._count.answers,
    })),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Public Exams</h1>
        <p className="text-sm text-muted-foreground">
          ค้นหาและทำข้อสอบสาธารณะได้ไม่จำกัดครั้ง ผลลัพธ์ล่าสุดจะถูกบันทึกไว้ให้คุณทบทวน
        </p>
      </header>
      <PublicExamBrowser exams={data} />
    </div>
  );
}
