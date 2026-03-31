import { prisma } from "@/lib/prisma";
import { authGuard } from "@/lib/auth-guard";
import { StudentAssignmentList } from "@/components/student/assignment-list";
import { Badge } from "@/components/ui/badge";

export default async function StudentExamsPage() {
  const user = await authGuard("student");

  const assignments = await prisma.studentExam.findMany({
    where: { studentId: user.id },
    include: {
      attempt: {
        select: {
          score: true,
        },
      },
      assignment: {
        include: {
          exam: {
            select: {
              id: true,
              title: true,
              questionCount: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  const serialized = assignments.map((link) => ({
    id: link.id,
    examTitle: link.assignment.exam.title,
    subjectName: link.assignment.subject.name,
    subjectCode: link.assignment.subject.code,
    status: link.status,
    assignedAt: link.assignedAt.toISOString(),
    startAt: link.assignment.startAt ? link.assignment.startAt.toISOString() : null,
    dueAt: link.assignment.dueAt ? link.assignment.dueAt.toISOString() : null,
    completedAt: link.completedAt ? link.completedAt.toISOString() : null,
    attemptId: link.attemptId,
    score: link.attempt?.score ?? null,
    totalQuestions: link.assignment.exam.questionCount,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">ข้อสอบที่รอมอบหมาย</h1>
          <p className="text-sm text-muted-foreground">
            แสดงทั้งงานที่ยังไม่เริ่ม กำลังทำ และประวัติที่ทำเสร็จแล้ว พร้อมดูผลและรายละเอียดได้
          </p>
        </div>
        <Badge className="self-start sm:self-auto" variant="outline">
          นักเรียน: {user.name ?? user.email}
        </Badge>
      </header>

      <StudentAssignmentList initialAssignments={serialized} />
    </div>
  );
}
