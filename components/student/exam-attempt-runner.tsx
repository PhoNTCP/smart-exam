"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AttemptQuestion = {
  id: string;
  body: string;
  subject: string;
  gradeLevel: string;
  hint: string;
  explanation: string;
  choices: Array<{ id: string; text: string }>;
};

type AttemptRunnerProps = {
  initial: {
    attemptId: string;
    examTitle: string;
    subjectName: string;
    subjectCode?: string;
    question: AttemptQuestion;
    answeredCount: number;
    total: number;
    theta: number;
    score: number;
  };
};

type AttemptSummary = {
  score: number;
  total: number;
  thetaStart: number;
  thetaEnd: number;
  answered: number;
};

export const ExamAttemptRunner = ({ initial }: AttemptRunnerProps) => {
  const router = useRouter();
  const [question, setQuestion] = useState<AttemptQuestion | null>(initial.question);
  const [answeredCount, setAnsweredCount] = useState(initial.answeredCount);
  const [theta, setTheta] = useState(initial.theta);
  const [score, setScore] = useState(initial.score);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(initial.total);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<AttemptSummary | null>(null);
  const [lastExplanation, setLastExplanation] = useState<string | null>(null);

  const submitAnswer = async () => {
    if (!question || !selectedChoice) {
      setFeedback({ type: "error", message: "กรุณาเลือกคำตอบก่อน" });
      return;
    }
    setPending(true);
    setFeedback(null);
    try {
      const currentQuestion = question;
      const response = await fetch("/api/exams/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: initial.attemptId,
          questionId: question.id,
          choiceId: selectedChoice,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setFeedback({ type: "error", message: json.message ?? "ส่งคำตอบไม่สำเร็จ" });
        return;
      }

      if (typeof json.total === "number") {
        setTotalQuestions(json.total);
      }

      if (currentQuestion) {
        if (json.isCorrect) {
          setLastExplanation(null);
        } else {
          setLastExplanation(currentQuestion.explanation);
        }
      }

      if (json.status === "completed") {
        setSummary(json.summary);
      if (json.summary?.total) {
        setTotalQuestions(json.summary.total);
      }
        if (json.summary?.total) {
          setTotalQuestions(json.summary.total);
        }
        setQuestion(null);
        setAnsweredCount(json.answeredCount ?? answeredCount + 1);
        setFeedback({
          type: json.isCorrect ? "success" : "error",
          message: json.isCorrect ? "ตอบถูก!" : "ตอบผิด",
        });
        return;
      }

      setFeedback({
        type: json.isCorrect ? "success" : "error",
        message: json.isCorrect ? "ตอบถูก! เตรียมข้อถัดไป" : "ตอบผิด ลองให้ดีในข้อถัดไป",
      });
      setQuestion(json.question);
      setAnsweredCount(json.answeredCount);
      setTheta(json.theta);
      setScore(json.score);
      setSelectedChoice(null);
      setHintVisible(false);
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "เกิดข้อผิดพลาดในการส่งคำตอบ" });
    } finally {
      setPending(false);
    }
  };

  const finishAttempt = async () => {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/exams/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: initial.attemptId }),
      });
      const json = await response.json();
      if (!response.ok) {
        setFeedback({ type: "error", message: json.message ?? "ไม่สามารถปิดการทำข้อสอบได้" });
        return;
      }
      setSummary(json.summary);
      if (json.summary?.total) {
        setTotalQuestions(json.summary.total);
      }
      setQuestion(null);
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "เกิดข้อผิดพลาดในการปิดข้อสอบ" });
    } finally {
      setPending(false);
    }
  };

  if (summary) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>สรุปผลการทำข้อสอบ</CardTitle>
            <CardDescription>ผลรวมจากข้อสอบแบบ Adaptive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              คะแนนรวม:{" "}
              <span className="font-semibold text-foreground">
                {summary.score} / {summary.total}
              </span>
            </p>
            <p>
              θ เริ่มต้น: <span className="font-semibold text-foreground">{summary.thetaStart.toFixed(2)}</span>
            </p>
            <p>
              θ สิ้นสุด: <span className="font-semibold text-foreground">{summary.thetaEnd.toFixed(2)}</span>
            </p>
            <p>ตอบทั้งหมด: {summary.answered} ข้อ</p>
            <div className="flex gap-3 pt-4">
              <Button onClick={() => router.push("/student/progress")}>ดูความก้าวหน้า</Button>
              <Button variant="outline" onClick={() => router.push("/student/exams")}>
                กลับไปเลือกข้อสอบอื่น
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!question) {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{initial.examTitle}</CardTitle>
              <CardDescription>
                วิชา {initial.subjectName} • ข้อที่ {answeredCount + 1} จาก {totalQuestions}
              </CardDescription>
            </div>
            <Badge variant="outline">θ ปัจจุบัน: {theta.toFixed(2)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium text-muted-foreground">โจทย์</p>
            <p className="mt-2 text-base leading-relaxed text-foreground">{question.body}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">ตัวเลือก</p>
            <div className="grid gap-3">
              {question.choices.map((choice) => (
                <label key={choice.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                  <input
                    type="radio"
                    name="choice"
                    value={choice.id}
                    className="h-4 w-4"
                    checked={selectedChoice === choice.id}
                    onChange={() => setSelectedChoice(choice.id)}
                  />
                  <span>{choice.text}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" type="button" onClick={() => setHintVisible((prev) => !prev)}>
              ขอคำใบ้ (AI)
            </Button>
            <Button type="button" onClick={submitAnswer} disabled={pending}>
              {pending ? "กำลังส่ง..." : "ส่งคำตอบ"}
            </Button>
            <Button variant="ghost" type="button" onClick={finishAttempt} disabled={pending}>
              ส่งข้อสอบ
            </Button>
            <Badge variant="secondary">คะแนนสะสม: {score}</Badge>
          </div>

          {hintVisible && (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">คำใบ้</p>
              <p className="mt-1 leading-relaxed">{question.hint}</p>
            </div>
          )}

          {lastExplanation && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium text-amber-900">เฉลย</p>
              <p className="mt-1 leading-relaxed text-amber-900">{lastExplanation}</p>
            </div>
          )}

          {feedback && (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                feedback.type === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {feedback.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
