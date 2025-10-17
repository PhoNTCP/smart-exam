import { prisma } from "@/lib/prisma";
import { authGuard } from "@/lib/auth-guard";
import { AdaptiveExamList } from "@/components/student/exam-list";
import { Badge } from "@/components/ui/badge";

export default async function StudentExamsPage() {
  const user = await authGuard("student");

  const memberships = await prisma.subjectEnrollment.findMany({
    where: { userId: user.id },
    select: { subjectId: true },
  });

  const subjectIds = memberships.map((membership) => membership.subjectId);

  const exams = subjectIds.length
    ? await prisma.exam.findMany({
        where: { isAdaptive: true, subjectId: { in: subjectIds } },
        include: {
          subjectRef: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const serialized = exams.map((exam) => ({
    id: exam.id,
    title: exam.title,
    subjectName: exam.subjectRef?.name ?? "ไม่ระบุ",
    subjectCode: exam.subjectRef?.code ?? "",
    isAdaptive: exam.isAdaptive,
    createdAt: exam.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ทำข้อสอบแบบปรับระดับ</h1>
          <p className="text-sm text-muted-foreground">
            เลือกวิชาเพื่อเริ่มทำข้อสอบ Adaptive (10 ข้อ, ปรับระดับตามความสามารถ)
          </p>
        </div>
        <Badge variant="outline">ยินดีต้อนรับ, {user.name ?? user.email}</Badge>
      </header>

      <AdaptiveExamList exams={serialized} />
    </div>
  );
}
