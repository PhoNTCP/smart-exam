"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type AttemptHistory = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  thetaStart: number;
  thetaEnd: number;
  score: number;
  answered: number;
};

type PublicExam = {
  id: string;
  title: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  isAdaptive: boolean;
  isPublic: boolean;
  questionCount: number;
  difficultyMin: number;
  difficultyMax: number;
  attempts: AttemptHistory[];
};

type PublicExamBrowserProps = {
  exams: PublicExam[];
};

export const PublicExamBrowser = ({ exams }: PublicExamBrowserProps) => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [historyExam, setHistoryExam] = useState<PublicExam | null>(null);

  const subjects = useMemo(
    () => Array.from(new Set(exams.map((exam) => exam.subjectName))).filter(Boolean),
    [exams],
  );

  const filtered = useMemo(() => {
    return exams.filter((exam) => {
      if (subjectFilter !== "all" && exam.subjectName !== subjectFilter) {
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
  }, [exams, subjectFilter, search]);

  const startExam = async (examId: string) => {
    setPendingId(examId);
    setFeedback(null);
    try {
      const response = await fetch("/api/exams/public/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "ไม่สามารถเริ่มข้อสอบได้");
      }
      if (!json.attemptId) {
        throw new Error("ไม่พบรหัสการทำข้อสอบ");
      }
      router.push(`/student/exams/${json.attemptId}`);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "ไม่สามารถเริ่มข้อสอบได้",
      });
    } finally {
      setPendingId(null);
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "-";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const latestResultLabel = (exam: PublicExam) => {
    const latest = exam.attempts.find((attempt) => Boolean(attempt.finishedAt));
    if (!latest) {
      return "ยังไม่เคยทำ";
    }
    if (exam.isAdaptive) {
      return `θ ล่าสุด: ${latest.thetaEnd.toFixed(2)}`;
    }
    return `คะแนนล่าสุด: ${latest.score}/${exam.questionCount}`;
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
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
        >
          <option value="all">ทุกวิชา</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={() => {
            setSubjectFilter("all");
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

      {filtered.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>ยังไม่มีข้อสอบ Public</CardTitle>
            <CardDescription>กรุณาลองค้นหาด้วยคำอื่นหรือกลับมาใหม่</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">ข้อสอบ</th>
                <th className="px-3 py-2 text-left font-medium">ผู้ออก</th>
                <th className="px-3 py-2 text-left font-medium">ประเภท</th>
                <th className="px-3 py-2 text-left font-medium">จำนวนข้อ / ความยาก</th>
                <th className="px-3 py-2 text-left font-medium">ผลล่าสุด</th>
                <th className="px-3 py-2 text-left font-medium">จำนวนครั้ง</th>
                <th className="px-3 py-2 text-left font-medium">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exam) => {
                const activeAttempt = exam.attempts.find((attempt) => !attempt.finishedAt);
                const buttonLabel = activeAttempt ? "ทำต่อ" : "เริ่มทำ";
                const isPending = pendingId === exam.id;

                return (
                  <tr key={exam.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{exam.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {exam.subjectName} ({exam.subjectCode})
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{exam.teacherName}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={exam.isAdaptive ? "default" : "secondary"}>
                          {exam.isAdaptive ? "Adaptive" : "Standard"}
                        </Badge>
                        {exam.isPublic && <Badge variant="outline">Public</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {exam.questionCount} ข้อ • {exam.difficultyMin}-{exam.difficultyMax}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{latestResultLabel(exam)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{exam.attempts.length}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            activeAttempt ? router.push(`/student/exams/${activeAttempt.id}`) : startExam(exam.id)
                          }
                          disabled={isPending}
                        >
                          {isPending ? "กำลังเปิด..." : buttonLabel}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setHistoryExam(exam);
                          }}
                        >
                          ประวัติ
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={Boolean(historyExam)}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryExam(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ประวัติการทำ - {historyExam?.title ?? "-"}</DialogTitle>
          </DialogHeader>
          {!historyExam || historyExam.attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่เคยทำข้อสอบชุดนี้</p>
          ) : (
            <div className="max-h-[360px] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">เวลาเริ่ม</th>
                    <th className="px-3 py-2 text-left font-medium">เวลาเสร็จ</th>
                    <th className="px-3 py-2 text-left font-medium">
                      {historyExam.isAdaptive ? "θ สิ้นสุด" : "คะแนน"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyExam.attempts.map((attempt) => (
                    <tr key={attempt.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{formatDateTime(attempt.startedAt)}</td>
                      <td className="px-3 py-2">{formatDateTime(attempt.finishedAt)}</td>
                      <td className="px-3 py-2">
                        {historyExam.isAdaptive
                          ? attempt.finishedAt
                            ? attempt.thetaEnd.toFixed(2)
                            : "กำลังทำ"
                          : `${attempt.score}/${historyExam.questionCount}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
