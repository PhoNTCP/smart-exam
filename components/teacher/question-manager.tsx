"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
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
  aiReason: string | null;
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
  const [rescoringId, setRescoringId] = useState<string | null>(null);
  const [reasonPreview, setReasonPreview] = useState<{ open: boolean; question: QuestionRow | null }>({
    open: false,
    question: null,
  });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    total: number;
    results: Array<{ row: number; status: "success" | "error"; message?: string }>;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

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

  const handleEdit = useCallback((row: QuestionRow) => {
    setEditingQuestion(row);
    setDialogOpen(true);
  }, []);

  const handleRescore = useCallback(
    async (id: string) => {
      setRescoringId(id);
      try {
        const response = await fetch("/api/ai/difficulty", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: id }),
        });

        if (!response.ok) {
          const json = await response.json().catch(() => ({}));
          if (response.status === 429) {
            setFeedback({ type: "error", message: json.message ?? "Queued for nightly batch" });
            return;
          }
          throw new Error(json.message ?? "Rescore failed");
        }

        setFeedback({ type: "success", message: "ส่งคำขอประเมินความยากสำเร็จ" });
        startTransition(() => {
          fetchQuestions();
          router.refresh();
        });
      } catch (error) {
        console.error(error);
        setFeedback({ type: "error", message: "ไม่สามารถเรียกประเมินความยากได้" });
      } finally {
        setRescoringId(null);
      }
    },
    [fetchQuestions, router],
  );

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
        header: "โจทย์ (ย่อ)",
        accessorKey: "body",
        cell: ({ row }) => (
          <div
            className="max-w-xs text-sm text-muted-foreground"
            title={row.original.body}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {row.original.body}
          </div>
        ),
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
        header: "เหตุผล (AI)",
        accessorKey: "aiReason",
        cell: ({ row }) => {
          const reason = row.original.aiReason;
          if (!reason) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setReasonPreview({
                  open: true,
                  question: row.original,
                })
              }
            >
              ดูเหตุผล
            </Button>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRescore(row.original.id)}
              title="Re-score"
              disabled={rescoringId === row.original.id}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [handleDelete, handleEdit, handleRescore, rescoringId],
  );

  const handleImportSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importFile) {
      setImportError("กรุณาเลือกไฟล์ Excel");
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const response = await fetch("/api/questions/import", {
        method: "POST",
        body: formData,
      });
      const json = await response.json();
      if (!response.ok) {
        setImportError(json.message ?? "นำเข้าข้อมูลไม่สำเร็จ");
        return;
      }
      setImportSummary(json);
      setFeedback({
        type: "success",
        message: `นำเข้าคำถามสำเร็จ ${json.imported} / ${json.total} ข้อ`,
      });
      startTransition(() => {
        fetchQuestions();
        router.refresh();
      });
    } catch (error) {
      console.error(error);
      setImportError("นำเข้าข้อมูลไม่สำเร็จ");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Question Bank</h1>
          <p className="text-sm text-muted-foreground">จัดการชุดคำถามสำหรับการออกข้อสอบ</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <a href="/api/questions/import/template" download>
              ดาวน์โหลดเทมเพลต
            </a>
          </Button>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">นำเข้าจาก Excel</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>นำเข้าคำถามผ่าน Excel</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleImportSubmit}>
                <p className="text-sm text-muted-foreground">
                  ดาวน์โหลดเทมเพลตและกรอกข้อมูลคำถาม 4 ตัวเลือก (ระบุคำตอบถูกเป็น A-D) แล้วอัปโหลดไฟล์ .xlsx
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                />
                {importError && <p className="text-sm text-destructive">{importError}</p>}
                {importSummary && (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p>
                      นำเข้าสำเร็จ {importSummary.imported} จาก {importSummary.total} ข้อ
                    </p>
                    {importSummary.results.some((item) => item.status === "error") && (
                      <div className="mt-2 max-h-40 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive">
                        {importSummary.results
                          .filter((item) => item.status === "error")
                          .map((item) => (
                            <p key={`error-${item.row}`}>แถว {item.row}: {item.message ?? "ข้อมูลไม่ถูกต้อง"}</p>
                          ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setImportDialogOpen(false);
                      setImportSummary(null);
                      setImportError(null);
                      setImportFile(null);
                    }}
                  >
                    ปิด
                  </Button>
                  <Button type="submit" disabled={importing}>
                    {importing ? "กำลังนำเข้า..." : "นำเข้า"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
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
              <Button>
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
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
      <Dialog
        open={reasonPreview.open}
        onOpenChange={(open) =>
          setReasonPreview((prev) => ({
            open,
            question: open ? prev.question : null,
          }))
        }
      >
        <DialogContent className="max-w-lg space-y-3">
          <DialogHeader>
            <DialogTitle>เหตุผลจาก AI</DialogTitle>
          </DialogHeader>
          {reasonPreview.question ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{reasonPreview.question.subject}</p>
              <p className="whitespace-pre-wrap">{reasonPreview.question.aiReason}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ไม่มีเหตุผลจาก AI</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
