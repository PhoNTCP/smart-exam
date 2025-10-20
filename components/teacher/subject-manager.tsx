"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SubjectRow = {
  id: string;
  code: string;
  name: string;
  level: string;
  examCount: number;
  studentCount: number;
  createdAt: string;
};

type FormState = {
  id?: string;
  code: string;
  name: string;
  level: string;
};

type SubjectSummaryResponse = {
  id: string;
  code: string;
  name: string;
  level: string;
  createdAt: string;
  examCount?: number;
  studentCount?: number;
};

const subjectLevels = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "U1",
  "U2",
  "U3",
  "U4",
  "U5",
  "U6",
  "UNSPECIFIED",
] as const;

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

export const SubjectManager = () => {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>({ code: "", name: "", level: "UNSPECIFIED" });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const resetForm = useCallback(() => {
    setFormState({ code: "", name: "", level: "UNSPECIFIED" });
  }, []);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/subjects/my");
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "โหลดข้อมูลวิชาไม่สำเร็จ");
      }
      const items: SubjectRow[] = (json.data as SubjectSummaryResponse[]).map((subject) => ({
        id: subject.id,
        code: subject.code,
        name: subject.name,
        level: subject.level,
        examCount: subject.examCount ?? 0,
        studentCount: subject.studentCount ?? 0,
        createdAt: subject.createdAt,
      }));
      setSubjects(items);
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "ไม่สามารถโหลดข้อมูลวิชาได้" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        code: formState.code,
        name: formState.name,
        level: formState.level,
      };

      const endpoint = formState.id ? `/api/subjects/${formState.id}` : "/api/subjects";
      const method = formState.id ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "ไม่สามารถบันทึกข้อมูลวิชาได้");
      }

      await fetchSubjects();
      setDialogOpen(false);
      resetForm();
      setFeedback({ type: "success", message: formState.id ? "อัปเดตวิชาสำเร็จ" : "สร้างวิชาสำเร็จ" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (subject: SubjectRow) => {
    setFormState({
      id: subject.id,
      code: subject.code,
      name: subject.name,
      level: subject.level,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (subjectId: string) => {
    setFeedback(null);
    try {
      const response = await fetch(`/api/subjects/${subjectId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message ?? "ไม่สามารถลบวิชาได้");
      }
      setFeedback({ type: "success", message: "ลบวิชาสำเร็จ" });
      await fetchSubjects();
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถลบวิชาได้" });
    }
  };

  const dialogTitle = formState.id ? "แก้ไขวิชา" : "เพิ่มวิชาใหม่";

  const sortedSubjects = useMemo(
    () =>
      [...subjects].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [subjects],
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>วิชาที่คุณสอน</CardTitle>
            <CardDescription>สร้างและจัดการวิชาก่อนสร้างข้อสอบ</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate}>เพิ่มวิชา</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogDescription>กรอกข้อมูลด้านล่างเพื่อจัดการวิชา</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">รหัสวิชา</label>
                  <Input
                    value={formState.code}
                    onChange={(event) => setFormState((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                    placeholder="เช่น MTH-M1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">ชื่อวิชา</label>
                  <Input
                    value={formState.name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="เช่น Mathematics"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">ระดับชั้น</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                    value={formState.level}
                    onChange={(event) => setFormState((prev) => ({ ...prev, level: event.target.value }))}
                  >
                    {subjectLevels.map((level) => (
                      <option key={level} value={level}>
                        {levelLabel(level)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  disabled={submitting}
                >
                  ยกเลิก
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {feedback && (
            <div
              className={`mb-4 rounded-md px-3 py-2 text-sm ${
                feedback.type === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {feedback.message}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</p>
          ) : sortedSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ยังไม่มีวิชาในระบบ เริ่มจากการเพิ่มวิชาแรกของคุณ
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">รหัสวิชา</th>
                    <th className="px-3 py-2 font-medium">ชื่อวิชา</th>
                    <th className="px-3 py-2 font-medium">ระดับ</th>
                    <th className="px-3 py-2 font-medium">ข้อสอบ</th>
                    <th className="px-3 py-2 font-medium">นักเรียน</th>
                    <th className="px-3 py-2 font-medium">การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSubjects.map((subject) => (
                    <tr key={subject.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground">{subject.code}</td>
                      <td className="px-3 py-2">{subject.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{levelLabel(subject.level)}</Badge>
                      </td>
                      <td className="px-3 py-2">{subject.examCount}</td>
                      <td className="px-3 py-2">{subject.studentCount}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(subject)}>
                            แก้ไข
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/teacher/subjects/${subject.id}`)}
                          >
                            จัดการ
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                ลบ
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
                                <AlertDialogDescription>
                                  วิชา {subject.name} และข้อสอบทั้งหมดภายใต้วิชานี้จะถูกลบถาวร
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(subject.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  ยืนยันการลบ
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
