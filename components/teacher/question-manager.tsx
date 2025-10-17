"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { QuestionForm } from "@/components/teacher/question-form";
import type { QuestionFormValues } from "@/lib/validators/question";

type QuestionRow = {
  id: string;
  subject: string;
  gradeLevel: string;
  body: string;
  explanation: string;
  shouldRescore: boolean;
  createdAt: string;
  updatedAt: string;
  difficulty: number | null;
  choices: Array<{ id: string; text: string; isCorrect: boolean; order: number }>;
};

type QuestionResponse = {
  data: QuestionRow[];
  page: number;
  pageSize: number;
  total: number;
  subjects: string[];
  grades: string[];
};

export const QuestionManager = () => {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  const fetchQuestions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.set("search", search);
      if (subjectFilter && subjectFilter !== "all") params.set("subject", subjectFilter);
      if (gradeFilter && gradeFilter !== "all") params.set("grade", gradeFilter);

      const response = await fetch(`/api/questions?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const json = (await response.json()) as QuestionResponse;
      setQuestions(
        json.data.map((question) => ({
          ...question,
          createdAt: new Date(question.createdAt).toLocaleString(),
          updatedAt: new Date(question.updatedAt).toLocaleString(),
        })),
      );
      setSubjects(json.subjects);
      setGrades(json.grades);
      setTotal(json.total);
      setPage(json.page);
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "ไม่สามารถดึงข้อมูลคำถามได้" });
    }
  }, [page, pageSize, search, subjectFilter, gradeFilter]);

  useEffect(() => {
    startTransition(() => {
      fetchQuestions();
    });
  }, [fetchQuestions]);

  const handleCreate = useCallback(() => {
    setEditingQuestion(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((row: QuestionRow) => {
    setEditingQuestion(row);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = window.confirm("ยืนยันลบคำถามนี้หรือไม่?");
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(`/api/questions/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        setFeedback({ type: "success", message: "ลบคำถามสำเร็จ" });
        startTransition(() => {
          fetchQuestions();
          router.refresh();
        });
      } catch (error) {
        console.error(error);
        setFeedback({ type: "error", message: "ลบคำถามไม่สำเร็จ" });
      }
    },
    [fetchQuestions, router],
  );

  const submitForm = async (values: QuestionFormValues) => {
    try {
      setIsSaving(true);
      const payload = {
        ...values,
        shouldRescore: values.shouldRescore ?? false,
      };
      const url = editingQuestion ? `/api/questions/${editingQuestion.id}` : "/api/questions";
      const method = editingQuestion ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message);
      }

      setDialogOpen(false);
      setFeedback({ type: "success", message: editingQuestion ? "แก้ไขคำถามสำเร็จ" : "เพิ่มคำถามสำเร็จ" });
      startTransition(() => {
        fetchQuestions();
        router.refresh();
      });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message: editingQuestion ? "แก้ไขคำถามไม่สำเร็จ" : "เพิ่มคำถามไม่สำเร็จ",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const columns: ColumnDef<QuestionRow>[] = useMemo(
    () => [
      {
        header: "วิชา",
        accessorKey: "subject",
      },
      {
        header: "ระดับชั้น",
        accessorKey: "gradeLevel",
      },
      {
        header: "ความยาก (AI)",
        accessorKey: "difficulty",
        cell: ({ getValue }) => {
          const difficulty = getValue() as number | null;
          return (
            <Badge variant={difficulty ? "secondary" : "outline"}>{difficulty ? `ระดับ ${difficulty}` : "—"}</Badge>
          );
        },
      },
      {
        header: "สร้างเมื่อ",
        accessorKey: "createdAt",
      },
      {
        id: "actions",
        header: "จัดการ",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(row.original)} title="แก้ไข">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(row.original.id)}
              title="ลบคำถาม"
              className="text-destructive hover:text-destructive focus-visible:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [handleDelete, handleEdit],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Question Bank</h1>
          <p className="text-sm text-muted-foreground">จัดการชุดคำถามสำหรับการออกข้อสอบ</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingQuestion(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มคำถาม
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingQuestion ? "แก้ไขคำถาม" : "เพิ่มคำถามใหม่"}</DialogTitle>
            </DialogHeader>
            <QuestionForm
              submitting={isSaving}
              initialValues={
                editingQuestion
                  ? {
                      subject: editingQuestion.subject,
                      gradeLevel: editingQuestion.gradeLevel,
                      body: editingQuestion.body,
                      explanation: editingQuestion.explanation,
                      shouldRescore: editingQuestion.shouldRescore,
                      choices: editingQuestion.choices.map((choice) => ({
                        text: choice.text,
                        isCorrect: choice.isCorrect,
                        order: choice.order,
                      })),
                    }
                  : undefined
              }
              onSubmit={submitForm}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="ค้นหา..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={subjectFilter}
            onChange={(event) => {
              setSubjectFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">ทุกวิชา</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={gradeFilter}
            onChange={(event) => {
              setGradeFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">ทุกระดับชั้น</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setSubjectFilter("all");
              setGradeFilter("all");
              setPage(1);
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
      </div>

      <DataTable data={questions} columns={columns} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          แสดง {rangeStart} - {rangeEnd} จากทั้งหมด {total} ข้อ
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1 || isPending}
          >
            ก่อนหน้า
          </Button>
          <span className="text-sm text-muted-foreground">
            หน้า {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages || isPending}
          >
            ถัดไป
          </Button>
        </div>
      </div>
    </div>
  );
};
