"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AssignmentStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

type StudentAssignmentRow = {
  id: string;
  examTitle: string;
  subjectName: string;
  subjectCode: string;
  status: AssignmentStatus;
  assignedAt: string;
  startAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  attemptId: string | null;
  score: number | null;
  totalQuestions: number;
};

type StudentAssignmentListProps = {
  initialAssignments: StudentAssignmentRow[];
};

const statusLabel: Record<AssignmentStatus, string> = {
  ASSIGNED: "ยังไม่เริ่ม",
  IN_PROGRESS: "กำลังทำ",
  COMPLETED: "สำเร็จ",
};

const statusVariant: Record<AssignmentStatus, "default" | "secondary" | "outline"> = {
  ASSIGNED: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const formatScore = (score: number | null, totalQuestions: number) => {
  if (score == null) return "-";
  return `${score}/${totalQuestions}`;
};

export const StudentAssignmentList = ({ initialAssignments }: StudentAssignmentListProps) => {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignmentRow | null>(null);

  const groupedAssignments = useMemo(() => {
    const groups = new Map<string, { subjectName: string; subjectCode: string; assignments: StudentAssignmentRow[] }>();

    for (const assignment of assignments) {
      const key = `${assignment.subjectName}::${assignment.subjectCode}`;
      const group = groups.get(key);
      if (group) {
        group.assignments.push(assignment);
        continue;
      }

      groups.set(key, {
        subjectName: assignment.subjectName,
        subjectCode: assignment.subjectCode,
        assignments: [assignment],
      });
    }

    return Array.from(groups.values());
  }, [assignments]);

  const handleStart = async (assignmentId: string) => {
    const target = assignments.find((item) => item.id === assignmentId);
    if (!target) return;

    if (target.status === "IN_PROGRESS" && target.attemptId) {
      router.push(`/student/exams/${target.attemptId}`);
      return;
    }

    const startAtTime =
      target.startAt && !Number.isNaN(new Date(target.startAt).getTime())
        ? new Date(target.startAt).getTime()
        : null;
    const isFutureStart = target.status === "ASSIGNED" && startAtTime != null && startAtTime > Date.now();
    if (isFutureStart) {
      setFeedback({ type: "error", message: "ยังไม่ถึงเวลาเริ่มทำข้อสอบชุดนี้" });
      return;
    }

    setLoadingId(assignmentId);
    setFeedback(null);
    try {
      const response = await fetch("/api/exams/startFromAssignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentExamId: assignmentId }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "ไม่สามารถเริ่มทำข้อสอบได้");
      }

      if (json.status === "completed") {
        setAssignments((prev) =>
          prev.map((item) =>
            item.id === assignmentId
              ? {
                  ...item,
                  status: "COMPLETED",
                  attemptId: json.attemptId ?? item.attemptId,
                  score: json.summary?.score ?? item.score,
                }
              : item,
          ),
        );
        setFeedback({ type: "success", message: "งานนี้ทำเสร็จแล้ว" });
        return;
      }

      setAssignments((prev) =>
        prev.map((item) =>
          item.id === assignmentId ? { ...item, status: "IN_PROGRESS", attemptId: json.attemptId } : item,
        ),
      );
      router.push(`/student/exams/${json.attemptId}`);
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถเริ่มทำข้อสอบได้" });
    } finally {
      setLoadingId(null);
    }
  };

  const now = Date.now();

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            feedback.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-destructive/15 text-destructive"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีงานที่ได้รับในขณะนี้</p>
      ) : (
        <div className="space-y-6">
          {groupedAssignments.map((group) => (
            <section key={`${group.subjectName}-${group.subjectCode}`} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{group.subjectName}</h3>
                  <p className="text-sm text-muted-foreground">รหัสวิชา {group.subjectCode}</p>
                </div>
                <Badge variant="outline">{group.assignments.length} งาน</Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">ข้อสอบ</th>
                      <th className="px-3 py-2 font-medium">สถานะ</th>
                      <th className="px-3 py-2 font-medium">เริ่มได้</th>
                      <th className="px-3 py-2 font-medium">กำหนดส่ง</th>
                      <th className="px-3 py-2 font-medium">คะแนน</th>
                      <th className="px-3 py-2 font-medium">ทำเสร็จเมื่อ</th>
                      <th className="px-3 py-2 font-medium">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.assignments.map((assignment) => {
                      const startAtTime = assignment.startAt ? new Date(assignment.startAt) : null;
                      const isValidStart = startAtTime && !Number.isNaN(startAtTime.getTime()) ? startAtTime : null;
                      const isFutureStart =
                        assignment.status === "ASSIGNED" && isValidStart != null && isValidStart.getTime() > now;
                      const isLoading = loadingId === assignment.id;
                      const isCompleted = assignment.status === "COMPLETED";
                      const buttonLabel = isLoading
                        ? assignment.status === "IN_PROGRESS"
                          ? "กำลังเปิด..."
                          : "กำลังเริ่ม..."
                        : assignment.status === "IN_PROGRESS"
                          ? "ทำต่อ"
                          : isFutureStart
                            ? "ยังไม่ถึงเวลา"
                            : "เริ่มทำ";

                      return (
                        <tr key={assignment.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{assignment.examTitle}</td>
                          <td className="px-3 py-2">
                            <Badge variant={statusVariant[assignment.status]}>{statusLabel[assignment.status]}</Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{formatDateTime(assignment.startAt)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{formatDateTime(assignment.dueAt)}</td>
                          <td className="px-3 py-2">{formatScore(assignment.score, assignment.totalQuestions)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{formatDateTime(assignment.completedAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              {!isCompleted ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleStart(assignment.id)}
                                  disabled={isLoading || isFutureStart}
                                  title={
                                    isFutureStart && isValidStart
                                      ? `จะเริ่มได้หลังจาก ${isValidStart.toLocaleString()}`
                                      : undefined
                                  }
                                >
                                  {buttonLabel}
                                </Button>
                              ) : null}
                              <Button size="sm" variant="outline" onClick={() => setSelectedAssignment(assignment)}>
                                ดูรายละเอียด
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={selectedAssignment != null} onOpenChange={(open) => !open && setSelectedAssignment(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>รายละเอียดงานที่ได้รับ</DialogTitle>
            <DialogDescription>
              {selectedAssignment ? `${selectedAssignment.subjectName} (${selectedAssignment.subjectCode})` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedAssignment ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">ข้อสอบ</p>
                <p className="font-medium">{selectedAssignment.examTitle}</p>
              </div>
              <div>
                <p className="text-muted-foreground">สถานะ</p>
                <Badge variant={statusVariant[selectedAssignment.status]}>{statusLabel[selectedAssignment.status]}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">วันที่ได้รับ</p>
                  <p>{formatDateTime(selectedAssignment.assignedAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">เริ่มได้</p>
                  <p>{formatDateTime(selectedAssignment.startAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">กำหนดส่ง</p>
                  <p>{formatDateTime(selectedAssignment.dueAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ทำเสร็จเมื่อ</p>
                  <p>{formatDateTime(selectedAssignment.completedAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">ผลลัพธ์</p>
                <p className="font-medium">{formatScore(selectedAssignment.score, selectedAssignment.totalQuestions)}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
