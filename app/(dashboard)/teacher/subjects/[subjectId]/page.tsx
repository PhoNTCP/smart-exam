import { notFound } from "next/navigation";
import { authGuard } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { SubjectDetail } from "@/components/teacher/subject-detail";

type PageParams = {
  params: Promise<{
    subjectId: string;
  }>;
};

export default async function TeacherSubjectDetailPage({ params }: PageParams) {
  const user = await authGuard("teacher");
  const { subjectId } = await params;

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, createdById: user.id },
    include: {
      _count: {
        select: {
          exams: true,
          enrollments: true,
        },
      },
      enrollments: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      exams: {
        include: {
          attempts: {
            select: {
              id: true,
              finishedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      assignments: {
        include: {
          exam: {
            select: {
              id: true,
              title: true,
            },
          },
          studentLinks: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              attempt: {
                select: {
                  id: true,
                  score: true,
                  finishedAt: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!subject) {
    notFound();
  }

  type ExamWithAttempts = typeof subject.exams[number];
  type Attempt = ExamWithAttempts["attempts"][number];
  type Enrollment = typeof subject.enrollments[number];
  type Assignment = typeof subject.assignments[number];
  type StudentLink = Assignment["studentLinks"][number];

  const totalAttempts = subject.exams.reduce<number>(
    (sum: number, exam: ExamWithAttempts) => sum + exam.attempts.length,
    0,
  );
  const completedAttempts = subject.exams.reduce<number>(
    (sum: number, exam: ExamWithAttempts) =>
      sum + exam.attempts.filter((attempt: Attempt) => Boolean(attempt.finishedAt)).length,
    0,
  );

  const summary = {
    examCount: subject._count.exams,
    studentCount: subject._count.enrollments,
    totalAttempts,
    completedAttempts,
    assignmentCount: subject.assignments.length,
  };

  const students = subject.enrollments.map((enrollment: Enrollment) => ({
    enrollmentId: enrollment.id,
    userId: enrollment.student.id,
    name: enrollment.student.name,
    email: enrollment.student.email,
    joinedAt: enrollment.createdAt.toISOString(),
  }));

  const exams = subject.exams.map((exam: ExamWithAttempts) => ({
    id: exam.id,
    title: exam.title,
    isAdaptive: exam.isAdaptive,
    createdAt: exam.createdAt.toISOString(),
    attemptCount: exam.attempts.length,
    completedCount: exam.attempts.filter((attempt: Attempt) => Boolean(attempt.finishedAt)).length,
    questionCount: exam.questionCount,
    difficultyMin: exam.difficultyMin,
    difficultyMax: exam.difficultyMax,
  }));

  const assignments = subject.assignments.map((assignment: Assignment) => ({
    id: assignment.id,
    examId: assignment.examId,
    examTitle: assignment.exam.title,
    startAt: assignment.startAt.toISOString(),
    dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
    createdAt: assignment.createdAt.toISOString(),
    assignedCount: assignment.studentLinks.length,
    completedCount: assignment.studentLinks.filter((link: StudentLink) => link.status === "COMPLETED").length,
    students: assignment.studentLinks.map((link: StudentLink) => ({
      studentId: link.student.id,
      studentName: link.student.name,
      studentEmail: link.student.email,
      status: link.status,
      attemptId: link.attempt?.id ?? null,
      score: link.attempt?.score ?? null,
      completedAt: link.attempt?.finishedAt ? link.attempt.finishedAt.toISOString() : null,
    })),
  }));

  const subjectInfo = {
    id: subject.id,
    code: subject.code,
    name: subject.name,
    level: subject.level,
    createdAt: subject.createdAt.toISOString(),
  };

  return (
    <SubjectDetail
      subject={subjectInfo}
      summary={summary}
      initialStudents={students}
      initialExams={exams}
      initialAssignments={assignments}
    />
  );
}



