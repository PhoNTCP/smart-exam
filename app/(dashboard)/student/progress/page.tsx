import { prisma } from "@/lib/prisma";
import { authGuard } from "@/lib/auth-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Student progress view summarising completed exams
export default async function StudentProgressPage() {
  const user = await authGuard("student");

  // Query exam results for the current student
  const results = await prisma.examAttempt.findMany({
    where: { userId: user.id },
    include: { exam: true },
    orderBy: { startedAt: "desc" },
  });
  type ResultRecord = (typeof results)[number];

  const completedCount = results.filter((result: ResultRecord) => Boolean(result.finishedAt)).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Render page heading */}
      <header>
        <h1 className="text-2xl font-semibold">ความคืบหน้า</h1>
        <p className="text-sm text-muted-foreground">ติดตามผลการสอบย้อนหลังของคุณ</p>
      </header>

      {/* Render summary card */}
      <Card>
        <CardHeader>
          <CardTitle>ผลรวมการสอบ</CardTitle>
          <CardDescription>จำนวนการสอบทั้งหมด {results.length} ครั้ง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            สอบเสร็จแล้ว {completedCount} / {results.length}
          </p>
          <Progress value={results.length ? (completedCount / results.length) * 100 : 0} />
        </CardContent>
      </Card>

      {/* Render result cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map((result: ResultRecord) => (
          <Card key={result.id}>
            <CardHeader>
              <CardTitle>{result.exam.title}</CardTitle>
              <CardDescription>สถานะ: {result.finishedAt ? "completed" : "in-progress"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>คะแนน: {result.score ?? "-"}</p>
              <p>
                θ: {result.thetaStart.toFixed(2)} ➜ {result.thetaEnd.toFixed(2)}
              </p>
              <p>อัปเดตล่าสุด: {(result.finishedAt ?? result.startedAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
        {results.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>ยังไม่มีข้อมูล</CardTitle>
              <CardDescription>เริ่มทำข้อสอบเพื่อดูความคืบหน้า</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
