import { authGuard } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";

const levelLabel = (value: string) => {
  if (value === "UNSPECIFIED") return "ไม่ระบุ";
  const prefix = value[0];
  const grade = value.slice(1);
  switch (prefix) {
    case "P":
      return `ประถม ${grade}`;
    case "M":
      return `มัธยม ${grade}`;
    case "U":
      return `มหาวิทยาลัย ปี ${grade}`;
    default:
      return value;
  }
};

export default async function StudentSubjectsPage() {
  const user = await authGuard("student");

  const subjects = await prisma.subjectEnrollment.findMany({
    where: { userId: user.id },
    include: {
      subject: {
        select: { id: true, code: true, name: true, level: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">วิชาที่ลงทะเบียน</h1>
          <p className="text-sm text-muted-foreground">รายการวิชาทั้งหมดที่คุณได้รับการลงทะเบียน</p>
        </div>
        <Badge className="self-start sm:self-auto" variant="outline">
          นักเรียน: {user.name ?? user.email}
        </Badge>
      </header>

      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีการลงทะเบียนในวิชาใด</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((enrollment) => (
            <div key={enrollment.subject.id} className="rounded-lg border p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{enrollment.subject.name}</h2>
                <Badge variant="secondary">{levelLabel(enrollment.subject.level)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">รหัสวิชา {enrollment.subject.code}</p>
              <p className="mt-4 text-xs text-muted-foreground">
                ลงทะเบียนเมื่อ {new Date(enrollment.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
