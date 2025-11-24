"use client";

import { useMemo, useState } from "react";
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
  isPublic: boolean;
  createdAt: string;
  attemptCount: number;
  completedCount: number;
  questionCount: number;
  difficultyMin: number;
  difficultyMax: number;
};

type StandardQuestion = {
  id: string;
  body: string;
  gradeLevel: string;
  difficulty: number | null;
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
  students: AssignmentStudentRow[];
};

type AssignmentStudentRow = {
  studentId: string;
  studentName: string | null;
  studentEmail: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
  attemptId: string | null;
  score: number | null;
  completedAt: string | null;
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

const difficultyLevels = [1, 2, 3, 4, 5] as const;

const DEFAULT_EXAM_FORM = {
  title: "",
  isAdaptive: true,
  isPublic: false,
  questionCount: 10,
  difficultyMin: 1,
} satisfies ExamFormState;

const formatDate = (iso: string) => new Date(iso).toLocaleString();

const ASSIGNMENT_STATUS_META: Record<
  AssignmentStudentRow["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ASSIGNED: { label: "ยังไม่เริ่ม", variant: "outline" },
  IN_PROGRESS: { label: "กำลังทำ", variant: "secondary" },
  COMPLETED: { label: "เสร็จสิ้น", variant: "default" },
};

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
  isPublic: boolean;
  questionCount: number;
  difficultyMin: number;
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
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "exams" | "assignments">("overview");
  const [students, setStudents] = useState<StudentRow[]>(initialStudents);
  const [exams, setExams] = useState<ExamRow[]>(initialExams);
  const [assignments, setAssignments] = useState<AssignmentRow[]>(initialAssignments);
  const [summaryState, setSummaryState] = useState(summary);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamRow | null>(null);
  const [examForm, setExamForm] = useState<ExamFormState>({ ...DEFAULT_EXAM_FORM });
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>({
    examId: initialExams[0]?.id ?? "",
    startAt: "",
    dueAt: "",
  });
  const [assignmentDetailOpen, setAssignmentDetailOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentRow | null>(null);
  const [questionPickerOpen, setQuestionPickerOpen] = useState(false);
  const [questionPickerExam, setQuestionPickerExam] = useState<ExamRow | null>(null);
  const [questionPool, setQuestionPool] = useState<StandardQuestion[]>([]);
  const [selectedStandardQuestions, setSelectedStandardQuestions] = useState<StandardQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [questionPickerMode, setQuestionPickerMode] = useState<"create" | "existing">("existing");

  const completionRate = useMemo(() => {
    if (summaryState.totalAttempts === 0) return "0%";
    const rate = (summaryState.completedAttempts / summaryState.totalAttempts) * 100;
    return `${rate.toFixed(1)}%`;
  }, [summaryState]);

  const handleEnroll = async () => {
    if (!enrollEmail) {
      setFeedback({ type: "error", message: "กรุณากรอกอีเมลนักเรียน" });
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
        throw new Error(json.message ?? "ไม่สามารถลงทะเบียนได้ในขณะนี้");
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
      setFeedback({ type: "success", message: "ลงทะเบียนนักเรียนสำเร็จ" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถลงทะเบียนได้ในขณะนี้" });
    } finally {
      setEnrolling(false);
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
        throw new Error(json.message ?? "ไม่สามารถเปลี่ยนโหมดข้อสอบได้");
      }
      setExams((prev) =>
        prev.map((item) =>
          item.id === exam.id
            ? { ...item, isAdaptive: json.data.isAdaptive ?? !item.isAdaptive }
            : item,
        ),
      );
      setFeedback({ type: "success", message: "เปลี่ยนโหมดข้อสอบเรียบร้อย" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนโหมดข้อสอบได้" });
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
      setFeedback({ type: "success", message: "ลบนักเรียนเรียบร้อย" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถลบนักเรียนได้" });
    }
  };

  const handleOpenCreateExam = () => {
    setFeedback(null);
    setEditingExam(null);
    setExamForm({ ...DEFAULT_EXAM_FORM });
    setSelectedStandardQuestions([]);
    setExamDialogOpen(true);
  };

  const handleOpenEditExam = (exam: ExamRow) => {
    setFeedback(null);
    setEditingExam(exam);
    setExamForm({
      title: exam.title,
      isAdaptive: exam.isAdaptive,
      isPublic: exam.isPublic,
      questionCount: exam.questionCount,
      difficultyMin: exam.difficultyMin,
    });
    setExamDialogOpen(true);
  };

  const handleOpenAssignmentDetails = (assignment: AssignmentRow) => {
    setSelectedAssignment(assignment);
    setAssignmentDetailOpen(true);
  };

  const loadQuestionPool = async () => {
    const response = await fetch(
      `/api/questions?subject=${encodeURIComponent(subject.name)}&pageSize=50`,
    );
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message ?? "ไม่สามารถโหลดคลังคำถามได้");
    }
    const questions: StandardQuestion[] = (json.data ?? []).map((item: any) => ({
      id: item.id,
      body: item.body,
      gradeLevel: item.gradeLevel,
      difficulty: item.difficulty ?? null,
    }));
    setQuestionPool(questions);
  };

  const loadSelectedQuestions = async (examId: string) => {
    const response = await fetch(`/api/exams/${examId}/questions`);
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message ?? "ไม่สามารถโหลดชุดคำถามเดิมได้");
    }
    const questions: StandardQuestion[] = (json.data ?? []).map((item: any) => ({
      id: item.id,
      body: item.body,
      gradeLevel: item.gradeLevel,
      difficulty: item.difficulty ?? null,
    }));
    setSelectedStandardQuestions(questions);
  };

  const handleOpenQuestionPicker = async (exam?: ExamRow | null) => {
    setFeedback(null);
    setQuestionPickerExam(exam ?? null);
    setQuestionPickerMode(exam ? "existing" : "create");
    setQuestionPickerOpen(true);
    setLoadingQuestions(true);
    try {
      const jobs: Array<Promise<unknown>> = [loadQuestionPool()];
      if (exam) {
        jobs.push(loadSelectedQuestions(exam.id));
      }
      await Promise.all(jobs);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "โหลดรายการคำถามไม่สำเร็จ",
      });
    } finally {
      setLoadingQuestions(false);
    }
  };

  const addStandardQuestion = (question: StandardQuestion) => {
    setSelectedStandardQuestions((prev) => {
      if (prev.some((item) => item.id === question.id)) {
        return prev;
      }
      return [...prev, question];
    });
  };

  const removeStandardQuestion = (questionId: string) => {
    setSelectedStandardQuestions((prev) => prev.filter((item) => item.id !== questionId));
  };

  const moveStandardQuestion = (questionId: string, direction: "up" | "down") => {
    setSelectedStandardQuestions((prev) => {
      const index = prev.findIndex((item) => item.id === questionId);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const handleSaveStandardQuestions = async () => {
    if (!questionPickerExam && questionPickerMode === "existing") return;
    if (selectedStandardQuestions.length === 0) {
      setFeedback({ type: "error", message: "กรุณาเลือกคำถามอย่างน้อย 1 ข้อ" });
      return;
    }
    setSavingQuestions(true);
    setFeedback(null);
    try {
      if (questionPickerExam) {
        const response = await fetch(`/api/exams/${questionPickerExam.id}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionIds: selectedStandardQuestions.map((q) => q.id),
          }),
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.message ?? "บันทึกชุดคำถามไม่สำเร็จ");
        }

        setExams((prev) =>
          prev.map((exam) =>
            exam.id === questionPickerExam.id
              ? { ...exam, questionCount: json.count ?? selectedStandardQuestions.length }
              : exam,
          ),
        );
      }

      setFeedback({ type: "success", message: "บันทึกชุดคำถามเรียบร้อย" });
      setQuestionPickerOpen(false);
      setQuestionPickerExam(null);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "บันทึกชุดคำถามไม่สำเร็จ",
      });
    } finally {
      setSavingQuestions(false);
    }
  };

  const validateExamForm = () => {
    if (!examForm.title.trim()) {
      setFeedback({ type: "error", message: "กรุณากรอกชื่อข้อสอบ" });
      return false;
    }
    if (!Number.isFinite(examForm.questionCount) || examForm.questionCount <= 0) {
      setFeedback({ type: "error", message: "จำนวนข้อสอบต้องมากกว่า 0" });
      return false;
    }
    return true;
  };

  const handleCreateExam = async () => {
    if (!validateExamForm()) {
      return;
    }
    if (!examForm.isAdaptive && selectedStandardQuestions.length === 0) {
      setFeedback({ type: "error", message: "โปรดเลือกคำถามสำหรับข้อสอบ Standard อย่างน้อย 1 ข้อ" });
      return;
    }
    setExamSubmitting(true);
    setFeedback(null);
    try {
      const questionCountPayload = examForm.isAdaptive
        ? examForm.questionCount
        : selectedStandardQuestions.length || examForm.questionCount;

      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: examForm.title.trim(),
          subjectId: subject.id,
          isAdaptive: examForm.isAdaptive,
          isPublic: examForm.isPublic,
          questionCount: questionCountPayload,
          difficultyMin: examForm.difficultyMin,
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
        isPublic: json.data.isPublic ?? examForm.isPublic,
        createdAt: json.data.createdAt,
        attemptCount: json.data.attemptCount ?? 0,
        completedCount: 0,
        questionCount: json.data.questionCount ?? examForm.questionCount,
        difficultyMin: json.data.difficultyMin ?? examForm.difficultyMin,
        difficultyMax: 0
      };

      if (!newExam.isAdaptive && selectedStandardQuestions.length > 0) {
        try {
          const qsResponse = await fetch(`/api/exams/${newExam.id}/questions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionIds: selectedStandardQuestions.map((q) => q.id) }),
          });
          const qsJson = await qsResponse.json();
          if (!qsResponse.ok) {
            throw new Error(qsJson.message ?? "ตั้งชุดคำถามไม่สำเร็จ");
          }
          newExam.questionCount = qsJson.count ?? selectedStandardQuestions.length;
        } catch (error) {
          console.error(error);
          setFeedback({
            type: "error",
            message: error instanceof Error ? error.message : "ตั้งชุดคำถามไม่สำเร็จ",
          });
        }
      }

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
      setEditingExam(null);
      setExamForm({ ...DEFAULT_EXAM_FORM });
      setSelectedStandardQuestions([]);
      setFeedback({ type: "success", message: "สร้างข้อสอบเรียบร้อย" });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "ไม่สามารถสร้างข้อสอบได้",
      });
    } finally {
      setExamSubmitting(false);
    }
  };

  const handleUpdateExam = async () => {
    if (!editingExam) {
      return;
    }
    if (!validateExamForm()) {
      return;
    }
    setExamSubmitting(true);
    setFeedback(null);
    try {
      const questionCountPayload = examForm.isAdaptive
        ? examForm.questionCount
        : selectedStandardQuestions.length || editingExam?.questionCount || examForm.questionCount;

      const response = await fetch(`/api/exams/${editingExam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: examForm.title.trim(),
          isAdaptive: examForm.isAdaptive,
          isPublic: examForm.isPublic,
          questionCount: questionCountPayload,
          difficultyMin: examForm.difficultyMin,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "ไม่สามารถอัปเดตข้อสอบได้");
      }
      setExams((prev) =>
        prev.map((item) =>
          item.id === editingExam.id
            ? {
                ...item,
                title: json.data?.title ?? examForm.title.trim(),
                isAdaptive: json.data?.isAdaptive ?? examForm.isAdaptive,
                isPublic: json.data?.isPublic ?? examForm.isPublic,
                questionCount: json.data?.questionCount ?? examForm.questionCount,
                difficultyMin: json.data?.difficultyMin ?? examForm.difficultyMin,
                attemptCount: json.data?.attemptCount ?? item.attemptCount,
                createdAt: json.data?.createdAt ?? item.createdAt,
              }
            : item,
        ),
      );
      setExamDialogOpen(false);
      setEditingExam(null);
      setExamForm({ ...DEFAULT_EXAM_FORM });
      setFeedback({ type: "success", message: "บันทึกการแก้ไขเรียบร้อย" });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "ไม่สามารถอัปเดตข้อสอบได้",
      });
    } finally {
      setExamSubmitting(false);
    }
  };
const handleCreateAssignment = async () => {
    if (!assignmentForm.examId) {
      setFeedback({ type: "error", message: "กรุณาเลือกข้อสอบก่อน" });
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
        throw new Error(json.message ?? "ไม่สามารถสร้างงานที่มอบหมายได้");
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
        students: students.map((student) => ({
          studentId: student.userId,
          studentName: student.name,
          studentEmail: student.email,
          status: "ASSIGNED",
          attemptId: null,
          score: null,
          completedAt: null,
        })),
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
      setFeedback({ type: "success", message: "สร้างงานที่มอบหมายสำเร็จ" });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถสร้างงานที่มอบหมายได้" });
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
          ภาพรวม
        </Button>
        <Button
          variant={activeTab === "students" ? "default" : "outline"}
          onClick={() => setActiveTab("students")}
        >
          นักเรียน
        </Button>
        <Button
          variant={activeTab === "exams" ? "default" : "outline"}
          onClick={() => setActiveTab("exams")}
        >
          ข้อสอบ
        </Button>
        <Button
          variant={activeTab === "assignments" ? "default" : "outline"}
          onClick={() => setActiveTab("assignments")}
        >
          งานที่มอบหมาย
        </Button>
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>ข้อสอบทั้งหมด</CardTitle>
              <CardDescription>จำนวนข้อสอบที่สร้างในรายวิชานี้</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{summaryState.examCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>นักเรียนทั้งหมด</CardTitle>
              <CardDescription>จำนวนนักเรียนที่ลงทะเบียนในรายวิชานี้</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{summaryState.studentCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>จำนวนครั้งที่ทำแบบทดสอบ</CardTitle>
              <CardDescription>รวมจำนวนการทำข้อสอบทั้งหมด</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{summaryState.totalAttempts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>อัตราสำเร็จ</CardTitle>
              <CardDescription>สัดส่วนการทำข้อสอบที่สำเร็จ</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{completionRate}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>งานที่มอบหมาย</CardTitle>
              <CardDescription>จำนวนงานที่มอบหมายให้กับนักเรียน</CardDescription>
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
            <CardTitle>นักเรียนในรายวิชา</CardTitle>
            <CardDescription>เพิ่ม/ลบนักเรียนด้วยอีเมล หรือจัดการรายชื่อนักเรียนในรายวิชา</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">เพิ่มด้วยอีเมล</label>
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
              <p className="text-sm text-muted-foreground">ยังไม่มีนักเรียนในรายวิชานี้</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">ชื่อนักเรียน</th>
                      <th className="px-3 py-2 font-medium">อีเมล</th>
                      <th className="px-3 py-2 font-medium">วันที่เข้าร่วม</th>
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
                                ลบ
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>ยืนยันการลบนักเรียน</AlertDialogTitle>
                                <AlertDialogDescription>
                                  คุณต้องการลบ {student.name ?? student.email} ออกจากรายวิชานี้หรือไม่?
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
              <CardTitle>ข้อสอบทั้งหมด</CardTitle>
              <CardDescription>จัดการและสร้างข้อสอบสำหรับ {subject.name}</CardDescription>
            </div>
            <Dialog
              open={examDialogOpen}
              onOpenChange={(open) => {
                setExamDialogOpen(open);
                if (!open) {
                  setEditingExam(null);
                  setExamForm({ ...DEFAULT_EXAM_FORM });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreateExam}>สร้างข้อสอบ</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingExam ? "แก้ไขข้อมูลข้อสอบ" : "สร้างข้อสอบใหม่"}</DialogTitle>
                  <DialogDescription>
                    {editingExam
                      ? `ปรับปรุงรายละเอียดข้อสอบ ${editingExam.title}`
                      : `ตั้งค่ารายละเอียดข้อสอบสำหรับ ${subject.name}`}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">ชื่อข้อสอบ</label>
                    <Input
                      placeholder="เช่น แบบทดสอบก่อนเรียน บทที่ 1"
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
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">การมองเห็นข้อสอบ</div>
                    <div className="rounded-md border border-dashed px-2 py-1 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={!examForm.isPublic ? "default" : "outline"}
                        onClick={() => setExamForm((prev) => ({ ...prev, isPublic: false }))}
                      >
                        Private
                      </Button>
                      <Button
                        size="sm"
                        variant={examForm.isPublic ? "default" : "outline"}
                        onClick={() => setExamForm((prev) => ({ ...prev, isPublic: true }))}
                      >
                        Public
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1" hidden={!examForm.isAdaptive}>
                      <label className="text-sm font-medium">จำนวนข้อสอบ</label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={examForm.questionCount}
                        onChange={(event) =>
                          setExamForm((prev) => {
                            const value = Number(event.target.value);
                            return { ...prev, questionCount: Number.isNaN(value) ? prev.questionCount : value };
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1" hidden={!examForm.isAdaptive}>
                      <label className="text-sm font-medium">ความยากขั้นต่ำ</label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                        value={examForm.difficultyMin}
                        onChange={(event) =>
                          setExamForm((prev) => ({
                            ...prev,
                            difficultyMin: Number(event.target.value),
                          }))
                        }
                        disabled={!examForm.isAdaptive}
                      >
                        {difficultyLevels.map((level) => (
                          <option key={level} value={level}>
                            ระดับ {level}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {!examForm.isAdaptive && (
                    <div className="rounded-md border border-dashed p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">เลือกคำถามสำหรับข้อสอบ Standard</p>
                          <p className="text-xs text-muted-foreground">
                            เลือกและเรียงลำดับคำถามได้ (จำนวนที่เลือก: {selectedStandardQuestions.length})
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleOpenQuestionPicker(null)}>
                          เลือกคำถาม
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setExamDialogOpen(false)} disabled={examSubmitting}>
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={editingExam ? handleUpdateExam : handleCreateExam}
                      disabled={examSubmitting}
                    >
                      {examSubmitting
                        ? editingExam
                          ? "กำลังบันทึก..."
                          : "กำลังสร้าง..."
                        : editingExam
                          ? "บันทึกการแก้ไข"
                          : "สร้างข้อสอบ"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-4">
            {exams.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีข้อสอบ</p>
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
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={exam.isAdaptive ? "default" : "secondary"}>
                            {exam.isAdaptive ? "Adaptive" : "Standard"}
                          </Badge>
                          {exam.isPublic && <Badge variant="outline">Public</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          ข้อสอบ {exam.questionCount} ข้อ
                          {exam.isAdaptive ? ` • ความยาก ${exam.difficultyMin}-${exam.difficultyMax}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!exam.isAdaptive && (
                          <Button variant="outline" size="sm" onClick={() => handleOpenQuestionPicker(exam)}>
                            เลือกคำถาม
                          </Button>
                        )}
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
                          onClick={() => handleOpenEditExam(exam)}
                        >
                          แก้ไขข้อสอบ
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
                                การลบข้อสอบจะลบสถิติ attempt ทั้งหมดของข้อสอบนี้
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
            <CardTitle>งานที่มอบหมาย</CardTitle>
            <CardDescription>สร้างและจัดการการมอบหมายข้อสอบให้กับนักเรียน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {exams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีข้อสอบ โปรดสร้างข้อสอบก่อน
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
                  <label className="text-sm font-medium">วันเวลาเริ่ม (ไม่บังคับ)</label>
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
                  <label className="text-sm font-medium">วันเวลาสิ้นสุด (ไม่บังคับ)</label>
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
                    {assignmentSubmitting ? "กำลังสร้าง..." : "สร้างงานที่มอบหมาย"}
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีงานที่มอบหมาย</p>
              ) : (
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">ข้อสอบ</th>
                      <th className="px-3 py-2 font-medium">เริ่ม</th>
                      <th className="px-3 py-2 font-medium">สิ้นสุด</th>
                      <th className="px-3 py-2 font-medium">มอบหมายแล้ว</th>
                      <th className="px-3 py-2 font-medium">ทำเสร็จแล้ว</th>
                      <th className="px-3 py-2 font-medium">คะแนน</th>
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
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenAssignmentDetails(assignment)}
                          >
                            ดูรายละเอียด
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={questionPickerOpen}
        onOpenChange={(open) => {
          setQuestionPickerOpen(open);
          if (!open) {
            setQuestionPickerExam(null);
          }
        }}
      >
        <DialogContent className="w-[96vw] max-w-[80vw] sm:max-w-[80vw] max-h-[82vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Pick Standard Questions</DialogTitle>
            <DialogDescription>
              เลือกคำถามมาจัดเป็นชุดสำหรับโหมด Standard และเรียงลำดับเองได้
            </DialogDescription>
          </DialogHeader>
          {loadingQuestions ? (
            <p className="text-sm text-muted-foreground">กำลังโหลดคำถาม...</p>
          ) : questionPickerExam || questionPickerMode === "create" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">คำถามในวิชา {subject.name}</p>
                  <Badge variant="outline">ทั้งหมด {questionPool.length}</Badge>
                </div>
                <div className="max-h-[60vh] overflow-y-auto space-y-2">
                  {questionPool.length === 0 ? (
                    <p className="text-sm text-muted-foreground">ยังไม่มีคำถาม</p>
                  ) : (
                    questionPool.map((q) => {
                      const picked = selectedStandardQuestions.some((item) => item.id === q.id);
                      return (
                        <div key={q.id} className="rounded-md border p-3 text-sm space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{q.body.slice(0, 80)}</span>
                            {q.difficulty ? <Badge variant="secondary">ระดับ {q.difficulty}</Badge> : null}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">ระดับชั้น: {q.gradeLevel}</span>
                            <Button
                              size="sm"
                              variant={picked ? "ghost" : "outline"}
                              disabled={picked}
                              onClick={() => addStandardQuestion(q)}
                            >
                              {picked ? "เลือกแล้ว" : "เพิ่ม"}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">ชุดที่เลือก (เรียงได้)</p>
                  <Badge variant="default">ทั้งหมด {selectedStandardQuestions.length}</Badge>
                </div>
                {selectedStandardQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ยังไม่ได้เลือกคำถาม กรุณาเพิ่ม</p>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto space-y-2">
                    {selectedStandardQuestions.map((q, index) => (
                      <div key={q.id} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                        <span className="w-8 text-xs text-muted-foreground">#{index + 1}</span>
                        <div className="flex-1">
                          <p className="font-medium truncate">{q.body.slice(0, 80)}</p>
                          <p className="text-xs text-muted-foreground">
                            {q.difficulty ? `ระดับ ${q.difficulty}` : "ระดับ ไม่ระบุ"} • ชั้น {q.gradeLevel}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => moveStandardQuestion(q.id, "up")}>
                            Up
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => moveStandardQuestion(q.id, "down")}>
                            Down
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeStandardQuestion(q.id)}>
                            ลบ
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setQuestionPickerOpen(false)} disabled={savingQuestions}>
                    ปิด
                  </Button>
                  <Button
                    onClick={handleSaveStandardQuestions}
                    disabled={savingQuestions || selectedStandardQuestions.length === 0}
                  >
                    {savingQuestions ? "กำลังบันทึก..." : "บันทึกชุดคำถาม"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ไม่พบข้อมูล</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={assignmentDetailOpen}
        onOpenChange={(open) => {
          setAssignmentDetailOpen(open);
          if (!open) {
            setSelectedAssignment(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              รายละเอียดคะแนน
              {selectedAssignment ? ` - ${selectedAssignment.examTitle}` : ""}
            </DialogTitle>
            <DialogDescription>
              ตรวจสอบสถานะและคะแนนของนักเรียนที่ได้รับมอบหมายงานสอบนี้
            </DialogDescription>
          </DialogHeader>
          {selectedAssignment ? (
            selectedAssignment.students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีนักเรียนในงานที่มอบหมายนี้
              </p>
            ) : (
              <div className="max-h-[360px] overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">นักเรียน</th>
                      <th className="px-3 py-2 text-left font-medium">สถานะ</th>
                      <th className="px-3 py-2 text-left font-medium">คะแนน</th>
                      <th className="px-3 py-2 text-left font-medium">เสร็จสิ้นเมื่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAssignment.students.map((student) => {
                      const meta = ASSIGNMENT_STATUS_META[student.status];
                      return (
                        <tr key={student.studentId} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {student.studentName ?? student.studentEmail}
                              </span>
                              <span className="text-xs text-muted-foreground">{student.studentEmail}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            {student.score != null ? student.score : "-"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {student.completedAt ? formatDate(student.completedAt) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};


