import { prisma } from "@/lib/prisma";
import { authGuard } from "@/lib/auth-guard";
import { StudentAssignmentList } from "@/components/student/assignment-list";
import { Badge } from "@/components/ui/badge";

export default async function StudentExamsPage() {
  const user = await authGuard("student");

  const assignments = await prisma.studentExam.findMany({
    where: { studentId: user.id },
    include: {
      assignment: {
        include: {
          exam: {
            select: {
              id: true,
              title: true,
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

  const outstanding = assignments.filter((link) => link.status !== "COMPLETED");

  const serialized = outstanding.map((link) => ({
    id: link.id,
    examTitle: link.assignment.exam.title,
    subjectName: link.assignment.subject.name,
    subjectCode: link.assignment.subject.code,
    status: link.status,
    assignedAt: link.assignedAt.toISOString(),
    startAt: link.assignment.startAt ? link.assignment.startAt.toISOString() : null,
    dueAt: link.assignment.dueAt ? link.assignment.dueAt.toISOString() : null,
    attemptId: link.attemptId,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ข้อสอบที่รอมอบหมาย</h1>
          <p className="text-sm text-muted-foreground">
            เริ่มทำข้อสอบจากรายการ Assignment ที่ครูส่งให้คุณ หากไม่มีรายการ แสดงว่ายังไม่ถูกมอบหมาย
          </p>
        </div>
        <Badge variant="outline">นักเรียน: {user.name ?? user.email}</Badge>
      </header>

      <StudentAssignmentList initialAssignments={serialized} />
    </div>
  );
}
