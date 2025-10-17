"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";

type SubjectInfo = {
  id: string;
  code: string;
  name: string;
  level: string;
  createdAt: string;
};

type SummaryInfo = {
  examCount: number;
  studentCount: number;
  totalAttempts: number;
  completedAttempts: number;
  assignmentCount: number;
};

type StudentRow = {
  enrollmentId: string;
  userId: string;
  name: string | null;
  email: string;
  joinedAt: string;
};

type ExamRow = {
  id: string;
  title: string;
  isAdaptive: boolean;
  createdAt: string;
  attemptCount: number;
  completedCount: number;
};

type AssignmentRow = {
  id: string;
  examId: string;
  examTitle: string;
  startAt: string;
  dueAt: string | null;
  createdAt: string;
  assignedCount: number;
  completedCount: number;
};

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

const formatDate = (iso: string) => new Date(iso).toLocaleString();

type SubjectDetailProps = {
  subject: SubjectInfo;
  summary: SummaryInfo;
  initialStudents: StudentRow[];
  initialExams: ExamRow[];
  initialAssignments: AssignmentRow[];
};

type ExamFormState = {
  title: string;
  isAdaptive: boolean;
};

type AssignmentFormState = {
  examId: string;
  startAt: string;
  dueAt: string;
};

export const SubjectDetail = ({
  subject,
  summary,
  initialStudents,
  initialExams,
  initialAssignments,
}: SubjectDetailProps) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "exams" | "assignments">("overview");
  const [students, setStudents] = useState<StudentRow[]>(initialStudents);
  const [exams, setExams] = useState<ExamRow[]>(initialExams);
  const [assignments, setAssignments] = useState<AssignmentRow[]>(initialAssignments);
  const [summaryState, setSummaryState] = useState(summary);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [examForm, setExamForm] = useState<ExamFormState>({ title: "", isAdaptive: true });
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>({
    examId: initialExams[0]?.id ?? "",
    startAt: "",
    dueAt: "",
  });

  const completionRate = useMemo(() => {
    if (summaryState.totalAttempts === 0) return "0%";
    const rate = (summaryState.completedAttempts / summaryState.totalAttempts) * 100;
    return `${rate.toFixed(1)}%`;
  }, [summaryState]);

  const handleEnroll = async () => {
    if (!enrollEmail) {
      setFeedback({ type: "error", message: "กรุณาระบุอีเมลนักเรียน" });
      return;
    }
    setEnrolling(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/subjects/${subject.id}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: enrollEmail }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "เพิ่มนักเรียนไม่สำเร็จ");
      }
      const newStudent: StudentRow = {
        enrollmentId: json.data.id,
        userId: json.data.userId,
        name: json.data.name ?? null,
        email: json.data.email,
        joinedAt: json.data.createdAt,
      };
      setStudents((prev) => [newStudent, ...prev]);
      setSummaryState((prev) => ({
        ...prev,
        studentCount: prev.studentCount + 1,
      }));
      setEnrollEmail("");
      setFeedback({ type: "success", message: "เพิ่มนักเรียนเรียบร้อย" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "เพิ่มนักเรียนไม่สำเร็จ" });
    } finally {
      setEnrolling(false);
    }
  };

  const handleRemoveStudent = async (userId: string) => {
    setFeedback(null);
    try {
      const response = await fetch(`/api/subjects/${subject.id}/enrollments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "ไม่สามารถลบนักเรียนได้");
      }
      setStudents((prev) => prev.filter((student) => student.userId !== userId));
      setSummaryState((prev) => ({
        ...prev,
        studentCount: Math.max(prev.studentCount - 1, 0),
      }));
      setFeedback({ type: "success", message: "ลบนักเรียนออกจากวิชาแล้ว" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถลบนักเรียนได้" });
    }
  };

  const handleCreateExam = async () => {
    if (!examForm.title.trim()) {
      setFeedback({ type: "error", message: "กรุณาระบุชื่อข้อสอบ" });
      return;
    }
    setExamSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: examForm.title.trim(),
          subjectId: subject.id,
          isAdaptive: examForm.isAdaptive,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "ไม่สามารถสร้างข้อสอบได้");
      }
      const newExam: ExamRow = {
        id: json.data.id,
        title: json.data.title,
        isAdaptive: json.data.isAdaptive,
        createdAt: json.data.createdAt,
        attemptCount: json.data.attemptCount ?? 0,
        completedCount: 0,
      };
      setExams((prev) => [newExam, ...prev]);
      setAssignmentForm((prev) => ({
        ...prev,
        examId: prev.examId || newExam.id,
      }));
      setSummaryState((prev) => ({
        ...prev,
        examCount: prev.examCount + 1,
      }));
      setExamDialogOpen(false);
      setExamForm({ title: "", isAdaptive: true });
      setFeedback({ type: "success", message: "สร้างข้อสอบเรียบร้อย" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถสร้างข้อสอบได้" });
    } finally {
      setExamSubmitting(false);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    setFeedback(null);
    try {
      const response = await fetch(`/api/exams/${examId}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "ไม่สามารถลบข้อสอบได้");
      }
      const removedExam = exams.find((exam) => exam.id === examId);
      setExams((prev) => prev.filter((exam) => exam.id !== examId));
      setSummaryState((prev) => ({
        examCount: Math.max(prev.examCount - 1, 0),
        studentCount: prev.studentCount,
        totalAttempts: removedExam ? prev.totalAttempts - removedExam.attemptCount : prev.totalAttempts,
        completedAttempts: removedExam ? prev.completedAttempts - removedExam.completedCount : prev.completedAttempts,
        assignmentCount: prev.assignmentCount,
      }));
      setFeedback({ type: "success", message: "ลบข้อสอบเรียบร้อย" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถลบข้อสอบได้" });
    }
  };

  const handleToggleExamMode = async (exam: ExamRow) => {
    setFeedback(null);
    try {
      const response = await fetch(`/api/exams/${exam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdaptive: !exam.isAdaptive }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "ไม่สามารถอัปเดตข้อสอบได้");
      }
      setExams((prev) =>
        prev.map((item) =>
          item.id === exam.id
            ? { ...item, isAdaptive: json.data.isAdaptive ?? !item.isAdaptive }
            : item,
        ),
      );
      setFeedback({ type: "success", message: "อัปเดตโหมดข้อสอบเรียบร้อย" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถอัปเดตข้อสอบได้" });
    }
  };

  const handleCreateAssignment = async () => {
    if (!assignmentForm.examId) {
      setFeedback({ type: "error", message: "กรุณาเลือกข้อสอบก่อนมอบหมาย" });
      return;
    }
    setAssignmentSubmitting(true);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        examId: assignmentForm.examId,
        subjectId: subject.id,
      };
      if (assignmentForm.startAt) {
        payload.startAt = new Date(assignmentForm.startAt).toISOString();
      }
      if (assignmentForm.dueAt) {
        payload.dueAt = new Date(assignmentForm.dueAt).toISOString();
      }

      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "ไม่สามารถมอบหมายข้อสอบได้");
      }

      const newAssignment: AssignmentRow = {
        id: json.data.id,
        examId: json.data.examId,
        examTitle: json.data.examTitle,
        startAt: json.data.startAt,
        dueAt: json.data.dueAt,
        createdAt: json.data.createdAt,
        assignedCount: json.data.assignedCount,
        completedCount: json.data.completedCount,
      };

      setAssignments((prev) => [newAssignment, ...prev]);
      setSummaryState((prev) => ({
        ...prev,
        assignmentCount: prev.assignmentCount + 1,
      }));
      setAssignmentForm((prev) => ({
        ...prev,
        startAt: "",
        dueAt: "",
      }));
      setFeedback({ type: "success", message: "มอบหมายข้อสอบเรียบร้อย" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถมอบหมายข้อสอบได้" });
    } finally {
      setAssignmentSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{subject.name}</h1>
        <p className="text-sm text-muted-foreground">
          รหัสวิชา {subject.code} • ระดับ {levelLabel(subject.level)}
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            feedback.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-destructive/15 text-destructive"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant={activeTab === "overview" ? "default" : "outline"}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </Button>
        <Button
          variant={activeTab === "students" ? "default" : "outline"}
          onClick={() => setActiveTab("students")}
        >
          Students
        </Button>
        <Button
          variant={activeTab === "exams" ? "default" : "outline"}
          onClick={() => setActiveTab("exams")}
        >
          Exams
        </Button>
        <Button
          variant={activeTab === "assignments" ? "default" : "outline"}
          onClick={() => setActiveTab("assignments")}
        >
          Assignments
        </Button>
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>จำนวนข้อสอบ</CardTitle>
              <CardDescription>ข้อสอบทั้งหมดในวิชานี้</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{summaryState.examCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>จำนวนนักเรียน</CardTitle>
              <CardDescription>นักเรียนที่ลงทะเบียน</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{summaryState.studentCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Attempt ทั้งหมด</CardTitle>
              <CardDescription>การทำข้อสอบทั้งหมด</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{summaryState.totalAttempts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Completion Rate</CardTitle>
              <CardDescription>สัดส่วนการทำข้อสอบจนเสร็จ</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{completionRate}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Assignments</CardTitle>
              <CardDescription>งานที่มอบหมายให้นักเรียน</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{summaryState.assignmentCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "students" && (
        <Card>
          <CardHeader>
            <CardTitle>นักเรียนในวิชา</CardTitle>
            <CardDescription>เพิ่มนักเรียนด้วยอีเมล หรือจัดการนักเรียนที่ลงทะเบียนแล้ว</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">Enroll by email</label>
                <Input
                  placeholder="student@example.com"
                  value={enrollEmail}
                  onChange={(event) => setEnrollEmail(event.target.value)}
                />
              </div>
              <Button onClick={handleEnroll} disabled={enrolling}>
                {enrolling ? "กำลังเพิ่ม..." : "เพิ่มนักเรียน"}
              </Button>
            </div>

            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีนักเรียนลงทะเบียนในวิชานี้</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">นักเรียน</th>
                      <th className="px-3 py-2 font-medium">อีเมล</th>
                      <th className="px-3 py-2 font-medium">วันที่เพิ่ม</th>
                      <th className="px-3 py-2 font-medium">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.enrollmentId} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {student.name ?? student.email}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{student.email}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatDate(student.joinedAt)}</td>
                        <td className="px-3 py-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                นำออก
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>ลบนักเรียนออกจากวิชา</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ต้องการลบ {student.name ?? student.email} ออกจากวิชานี้หรือไม่?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => handleRemoveStudent(student.userId)}
                                >
                                  ยืนยัน
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "exams" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>ข้อสอบในวิชานี้</CardTitle>
              <CardDescription>สร้างข้อสอบใหม่ หรือจัดการข้อสอบที่มีอยู่</CardDescription>
            </div>
            <Dialog open={examDialogOpen} onOpenChange={setExamDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setExamDialogOpen(true)}>Create exam</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>สร้างข้อสอบใหม่</DialogTitle>
                  <DialogDescription>ข้อสอบจะถูกผูกกับวิชา {subject.name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">ชื่อข้อสอบ</label>
                    <Input
                      placeholder="เช่น แบบทดสอบกลางภาค"
                      value={examForm.title}
                      onChange={(event) => setExamForm((prev) => ({ ...prev, title: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">โหมดข้อสอบ</label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                      value={examForm.isAdaptive ? "adaptive" : "standard"}
                      onChange={(event) =>
                        setExamForm((prev) => ({ ...prev, isAdaptive: event.target.value === "adaptive" }))
                      }
                    >
                      <option value="adaptive">Adaptive</option>
                      <option value="standard">Standard</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setExamDialogOpen(false)} disabled={examSubmitting}>
                    ยกเลิก
                  </Button>
                  <Button onClick={handleCreateExam} disabled={examSubmitting}>
                    {examSubmitting ? "กำลังสร้าง..." : "สร้างข้อสอบ"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-4">
            {exams.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีข้อสอบในวิชานี้</p>
            ) : (
              <div className="space-y-3">
                {exams.map((exam) => (
                  <div key={exam.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-base font-semibold">{exam.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          สร้างเมื่อ {formatDate(exam.createdAt)} • Attempt ทั้งหมด {exam.attemptCount} • เสร็จสมบูรณ์{" "}
                          {exam.completedCount}
                        </p>
                        <Badge variant={exam.isAdaptive ? "default" : "secondary"} className="mt-2">
                          {exam.isAdaptive ? "Adaptive" : "Standard"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleExamMode(exam)}
                        >
                          สลับเป็น {exam.isAdaptive ? "Standard" : "Adaptive"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/teacher/questions`)}
                        >
                          จัดการข้อสอบ
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              ลบ
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>ยืนยันการลบข้อสอบ</AlertDialogTitle>
                              <AlertDialogDescription>
                                เมื่อยืนยัน ข้อสอบและ attempt ที่เกี่ยวข้องจะถูกลบทั้งหมด
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => handleDeleteExam(exam.id)}
                              >
                                ยืนยัน
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "assignments" && (
        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>มอบหมายข้อสอบให้กับนักเรียนในวิชานี้</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {exams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีข้อสอบในวิชานี้ สร้างข้อสอบก่อนจึงจะมอบหมายได้
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">เลือกข้อสอบ</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                    value={assignmentForm.examId}
                    onChange={(event) =>
                      setAssignmentForm((prev) => ({ ...prev, examId: event.target.value }))
                    }
                  >
                    <option value="">- เลือกข้อสอบ -</option>
                    {exams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">วันเวลาเริ่มต้น (ไม่บังคับ)</label>
                  <input
                    type="datetime-local"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                    value={assignmentForm.startAt}
                    onChange={(event) =>
                      setAssignmentForm((prev) => ({ ...prev, startAt: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">กำหนดส่ง (ไม่บังคับ)</label>
                  <input
                    type="datetime-local"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                    value={assignmentForm.dueAt}
                    onChange={(event) =>
                      setAssignmentForm((prev) => ({ ...prev, dueAt: event.target.value }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCreateAssignment} disabled={assignmentSubmitting}>
                    {assignmentSubmitting ? "กำลังมอบหมาย..." : "มอบหมายข้อสอบ"}
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีการมอบหมายข้อสอบในวิชานี้</p>
              ) : (
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">ข้อสอบ</th>
                      <th className="px-3 py-2 font-medium">เริ่ม</th>
                      <th className="px-3 py-2 font-medium">กำหนดส่ง</th>
                      <th className="px-3 py-2 font-medium">มอบหมาย</th>
                      <th className="px-3 py-2 font-medium">เสร็จสิ้น</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment) => (
                      <tr key={assignment.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{assignment.examTitle}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {assignment.startAt ? formatDate(assignment.startAt) : "-"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {assignment.dueAt ? formatDate(assignment.dueAt) : "-"}
                        </td>
                        <td className="px-3 py-2">{assignment.assignedCount}</td>
                        <td className="px-3 py-2">{assignment.completedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
