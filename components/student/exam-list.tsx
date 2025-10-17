"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ExamItem = {
  id: string;
  title: string;
  subjectName: string;
  subjectCode: string;
  isAdaptive: boolean;
  createdAt: string;
};

export const AdaptiveExamList = ({ exams }: { exams: ExamItem[] }) => {
  const router = useRouter();
  const [subject, setSubject] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const subjects = useMemo(
    () => Array.from(new Set(exams.map((exam) => exam.subjectName))).filter(Boolean),
    [exams],
  );

  const filtered = useMemo(() => {
    return exams.filter((exam) => {
      if (subject !== "all" && exam.subjectName !== subject) {
        return false;
      }
      if (!search) {
        return true;
      }
      const term = search.toLowerCase();
      return (
        exam.title.toLowerCase().includes(term) ||
        exam.subjectName.toLowerCase().includes(term) ||
        exam.subjectCode.toLowerCase().includes(term)
      );
    });
  }, [exams, subject, search]);

  const startAttempt = async (examId: string) => {
    setPendingId(examId);
    setFeedback(null);
    try {
      const response = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });
      const json = await response.json();
      if (!response.ok) {
        setFeedback({ type: "error", message: json.message ?? "ไม่สามารถเริ่มข้อสอบได้" });
        return;
      }
      if (!json.attemptId) {
        setFeedback({ type: "error", message: "ไม่พบรหัสการทำข้อสอบ" });
        return;
      }
      startTransition(() => {
        router.push(`/student/exams/${json.attemptId}`);
      });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "เกิดข้อผิดพลาดในการเริ่มข้อสอบ" });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          placeholder="ค้นหาข้อสอบ..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        >
          <option value="all">ทุกวิชา</option>
          {subjects.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={() => {
            setSubject("all");
            setSearch("");
          }}
        >
          ล้างตัวกรอง
        </Button>
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((exam) => (
          <Card key={exam.id}>
            <CardHeader>
              <CardTitle>{exam.title}</CardTitle>
              <CardDescription>{exam.subjectName}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                ประเภทข้อสอบ:{" "}
                <Badge variant={exam.isAdaptive ? "default" : "secondary"}>
                  {exam.isAdaptive ? "Adaptive" : "Standard"}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground">อัปเดตล่าสุด: {new Date(exam.createdAt).toLocaleString()}</p>
              <Button
                disabled={!exam.isAdaptive || pendingId === exam.id || isPending}
                onClick={() => startAttempt(exam.id)}
              >
                {pendingId === exam.id ? "กำลังเริ่ม..." : "เริ่มทำข้อสอบ"}
              </Button>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>ยังไม่มีข้อสอบที่พร้อมทำ</CardTitle>
              <CardDescription>กรุณาลองเลือกวิชาอื่นหรือกลับมาอีกครั้ง</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};
