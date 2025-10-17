import { prisma } from "@/lib/prisma";
import { authGuard } from "@/lib/auth-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Teacher reports view summarising exam performance
export default async function TeacherReportsPage() {
  const user = await authGuard("teacher");

  // Query exam results for the teacher's exams
  const attempts = await prisma.examAttempt.findMany({
    where: { exam: { createdById: user.id } },
    include: {
      exam: true,
      user: true,
    },
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  type AttemptRecord = (typeof attempts)[number];

  return (
    <div className="flex flex-col gap-6">
      {/* Render page heading */}
      <header>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมความคืบหน้าของนักเรียนล่าสุด</p>
      </header>

      {/* Render result cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {attempts.map((attempt: AttemptRecord) => (
          <Card key={attempt.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {attempt.user.name ?? attempt.user.email}
                <Badge>{attempt.finishedAt ? "completed" : "in-progress"}</Badge>
              </CardTitle>
              <CardDescription>{attempt.exam.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                คะแนน: <span className="font-medium">{attempt.score}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                θ:{" "}
                <span className="font-medium">
                  {attempt.thetaStart.toFixed(2)} ➜ {attempt.thetaEnd.toFixed(2)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                อัปเดตล่าสุด:{" "}
                {attempt.finishedAt ? attempt.finishedAt.toLocaleString() : attempt.startedAt.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
        {attempts.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>ยังไม่มีรายงาน</CardTitle>
              <CardDescription>เริ่มสร้างข้อสอบเพื่อดูผลลัพธ์ที่นี่</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
