"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  attempts: AttemptHistory[];
};

type PublicExamBrowserProps = {
  exams: PublicExam[];
};

type SubjectGroup = {
  key: string;
  subjectName: string;
  subjectCode: string;
  exams: PublicExam[];
};

export const PublicExamBrowser = ({ exams }: PublicExamBrowserProps) => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [historyExam, setHistoryExam] = useState<PublicExam | null>(null);
  const [openSubjectKey, setOpenSubjectKey] = useState<string | null>(null);

  const subjects = useMemo(
    () => Array.from(new Set(exams.map((exam) => exam.subjectName))).filter(Boolean).sort(),
    [exams],
  );

  const filtered = useMemo(() => {
    return exams.filter((exam) => {
      if (subjectFilter !== "all" && exam.subjectName !== subjectFilter) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      const term = search.toLowerCase();
      return (
        exam.title.toLowerCase().includes(term) ||
        exam.subjectName.toLowerCase().includes(term) ||
        exam.subjectCode.toLowerCase().includes(term) ||
        exam.teacherName.toLowerCase().includes(term)
      );
    });
  }, [exams, search, subjectFilter]);

  const groupedExams = useMemo<SubjectGroup[]>(() => {
    const groups = new Map<string, SubjectGroup>();

    for (const exam of filtered) {
      const key = `${exam.subjectName}::${exam.subjectCode}`;
      const existing = groups.get(key);

      if (existing) {
        existing.exams.push(exam);
        continue;
      }

      groups.set(key, {
        key,
        subjectName: exam.subjectName,
        subjectCode: exam.subjectCode,
        exams: [exam],
      });
    }

    return Array.from(groups.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [filtered]);

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
      return `theta ล่าสุด ${latest.thetaEnd.toFixed(2)}`;
    }
    return `คะแนนล่าสุด ${latest.score}/${exam.questionCount}`;
  };

  const toggleSubject = (subjectKey: string) => {
    setOpenSubjectKey((current) => (current === subjectKey ? null : subjectKey));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)_auto]">
          <Input
            placeholder="ค้นหาข้อสอบ วิชา หรือผู้สอน..."
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
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{groupedExams.length} วิชา</Badge>
          <Badge variant="outline">{filtered.length} ข้อสอบ</Badge>
          <span>กดที่วิชาเพื่อขยายดูข้อสอบ</span>
        </div>
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

      {groupedExams.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>ยังไม่มีข้อสอบ Public</CardTitle>
            <CardDescription>ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองแล้วดูอีกครั้ง</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedExams.map((group) => {
            const isOpen = openSubjectKey === group.key;
            const adaptiveCount = group.exams.filter((exam) => exam.isAdaptive).length;

            return (
              <section key={group.key} className="overflow-hidden rounded-xl border bg-card">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/30"
                  onClick={() => toggleSubject(group.key)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-foreground">{group.subjectName}</h2>
                      <p className="text-sm text-muted-foreground">รหัสวิชา {group.subjectCode}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Badge variant="outline">{group.exams.length} ข้อสอบ</Badge>
                    <Badge variant="secondary">{adaptiveCount} Adaptive</Badge>
                  </div>
                </button>

                {isOpen ? (
                  <div className="border-t">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                      <span>แสดงรายการข้อสอบของวิชานี้</span>
                      <span>{group.exams.length} รายการ</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px] text-sm">
                        <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">ข้อสอบ</th>
                            <th className="px-4 py-3 text-left font-medium">ผู้สอน</th>
                            <th className="px-4 py-3 text-left font-medium">ประเภท</th>
                            <th className="px-4 py-3 text-left font-medium">จำนวนข้อ</th>
                            <th className="px-4 py-3 text-left font-medium">ผลล่าสุด</th>
                            <th className="px-4 py-3 text-left font-medium">จำนวนครั้ง</th>
                            <th className="px-4 py-3 text-left font-medium">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.exams.map((exam) => {
                            const activeAttempt = exam.attempts.find((attempt) => !attempt.finishedAt);
                            const buttonLabel = activeAttempt ? "ทำต่อ" : "เริ่มทำ";
                            const isPending = pendingId === exam.id;

                            return (
                              <tr key={exam.id} className="border-b last:border-0">
                                <td className="px-4 py-3">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-foreground">{exam.title}</span>
                                    <span className="text-xs text-muted-foreground">{latestResultLabel(exam)}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{exam.teacherName}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={exam.isAdaptive ? "default" : "secondary"}>
                                      {exam.isAdaptive ? "Adaptive" : "Standard"}
                                    </Badge>
                                    {exam.isPublic && <Badge variant="outline">Public</Badge>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{exam.questionCount} ข้อ</td>
                                <td className="px-4 py-3 text-muted-foreground">{latestResultLabel(exam)}</td>
                                <td className="px-4 py-3 text-muted-foreground">{exam.attempts.length}</td>
                                <td className="px-4 py-3">
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
                                    <Button size="sm" variant="outline" onClick={() => setHistoryExam(exam)}>
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
                  </div>
                ) : null}
              </section>
            );
          })}
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
                      {historyExam.isAdaptive ? "theta สุดท้าย" : "คะแนน"}
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
