"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  attemptId: string | null;
};

type StudentAssignmentListProps = {
  initialAssignments: StudentAssignmentRow[];
};

const statusLabel: Record<AssignmentStatus, string> = {
  ASSIGNED: "ยังไม่เริ่ม",
  IN_PROGRESS: "กำลังทำ",
  COMPLETED: "เสร็จแล้ว",
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

export const StudentAssignmentList = ({ initialAssignments }: StudentAssignmentListProps) => {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleStart = async (assignmentId: string) => {
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
              ? { ...item, status: "COMPLETED", attemptId: json.attemptId ?? item.attemptId }
              : item,
          ),
        );
        setFeedback({ type: "success", message: "ข้อสอบชุดนี้ทำเสร็จแล้ว" });
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">วิชา</th>
                <th className="px-3 py-2 font-medium">ข้อสอบ</th>
                <th className="px-3 py-2 font-medium">สถานะ</th>
                <th className="px-3 py-2 font-medium">เริ่มได้</th>
                <th className="px-3 py-2 font-medium">กำหนดส่ง</th>
                <th className="px-3 py-2 font-medium">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">
                    {assignment.subjectName}{" "}
                    <span className="text-xs text-muted-foreground">({assignment.subjectCode})</span>
                  </td>
                  <td className="px-3 py-2">{assignment.examTitle}</td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant[assignment.status]}>{statusLabel[assignment.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDateTime(assignment.startAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDateTime(assignment.dueAt)}</td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      onClick={() => handleStart(assignment.id)}
                      disabled={assignment.status === "COMPLETED" || loadingId === assignment.id}
                    >
                      {assignment.status === "COMPLETED"
                        ? "เสร็จแล้ว"
                        : loadingId === assignment.id
                          ? "กำลังเริ่ม..."
                          : "เริ่มทำ"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
