import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { authGuard } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Student exam listing
export default async function StudentExamsPage() {
  const user = await authGuard("student");

  // Query recent exams available to the student
  const exams = await prisma.exam.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  type ExamRecord = (typeof exams)[number];

  return (
    <div className="flex flex-col gap-6">
      {/* Render page heading */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">กำหนดการสอบ</h1>
          <p className="text-sm text-muted-foreground">ตรวจสอบข้อสอบที่กำลังมาถึง</p>
        </div>
        <Badge variant="outline">ยินดีต้อนรับ, {user.name ?? user.email}</Badge>
      </header>

      {/* Render exam cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exams.map((exam: ExamRecord) => (
          <Card key={exam.id}>
            <CardHeader>
              <CardTitle>{exam.title}</CardTitle>
              <CardDescription>{exam.subject}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                ประเภทข้อสอบ:{" "}
                <Badge variant={exam.isAdaptive ? "default" : "secondary"}>
                  {exam.isAdaptive ? "Adaptive" : "Standard"}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                บันทึกล่าสุด: {exam.createdAt.toLocaleString()}
              </p>
              <Button asChild>
                <Link href="#">เริ่มทำข้อสอบ</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {exams.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>ยังไม่มีข้อสอบ</CardTitle>
              <CardDescription>คุณจะเห็นข้อสอบที่ครูกำหนดไว้ที่นี่</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
