import { notFound, redirect } from "next/navigation";
import { authGuard } from "@/lib/auth-guard";
import {
  ADAPTIVE_TOTAL,
  ensureCurrentQuestion,
  finishAttempt,
  formatAttemptSummary,
  toThetaNumber,
} from "@/lib/services/adaptive-engine";
import { ExamAttemptRunner } from "@/components/student/exam-attempt-runner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AttemptPageProps = {
  params: Promise<{
    attemptId: string;
  }>;
};

export default async function StudentAttemptPage({ params }: AttemptPageProps) {
  const user = await authGuard("student");

  const { attemptId } = await params;

  if (!attemptId) {
    notFound();
  }

  const assignment = await ensureCurrentQuestion(attemptId, user.id ?? "");
  if (!assignment) {
    notFound();
  }

  const attempt = assignment.attempt;

  if (!attempt) {
    notFound();
  }

  if (attempt.userId !== user.id) {
    redirect("/student/exams");
  }

  if (!("exam" in attempt) || !attempt.exam?.subjectRef) {
    notFound();
  }

  const examInfo = (attempt as typeof attempt & { exam: { title: string; subjectRef: { name: string; code: string } } }).exam;

  const theta = toThetaNumber(attempt.thetaEnd ?? attempt.thetaStart);

  if (!assignment.question) {
    const summaryAttempt = await finishAttempt(attemptId, user.id ?? "");
    const summary = formatAttemptSummary(summaryAttempt);
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ข้อสอบเสร็จสิ้นแล้ว</CardTitle>
            <CardDescription>ดูผลลัพธ์โดยรวมด้านล่าง</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              คะแนนรวม:{" "}
              <span className="font-semibold text-foreground">
                {summary.score} / {summary.total}
              </span>
            </p>
            <p>
              θ เริ่มต้น: <span className="font-semibold text-foreground">{summary.thetaStart.toFixed(2)}</span>
            </p>
            <p>
              θ สิ้นสุด: <span className="font-semibold text-foreground">{summary.thetaEnd.toFixed(2)}</span>
            </p>
            <p>ตอบทั้งหมด: {summary.answered} ข้อ</p>
            <Button asChild className="mt-4">
              <a href="/student/progress">กลับไปหน้าสรุปผล</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ExamAttemptRunner
      initial={{
        attemptId: attempt.id,
        examTitle: examInfo.title,
        subjectName: examInfo.subjectRef.name,
        subjectCode: examInfo.subjectRef.code,
        question: assignment.question,
        answeredCount: assignment.answeredCount,
        total: ADAPTIVE_TOTAL,
        theta,
        score: attempt.score,
      }}
    />
  );
}
