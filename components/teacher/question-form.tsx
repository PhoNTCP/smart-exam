"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { questionCreateSchema, type QuestionFormValues } from "@/lib/validators/question";

type QuestionFormProps = {
  initialValues?: {
    subject: string;
    gradeLevel: string;
    body: string;
    explanation: string;
    shouldRescore: boolean;
    choices: Array<{ text: string; isCorrect: boolean; order: number }>;
  };
  submitting: boolean;
  onSubmit: (values: QuestionFormValues) => Promise<void>;
};

const createDefaultChoices = () =>
  Array.from({ length: 4 }).map((_, index) => ({
    text: "",
    isCorrect: index === 0,
    order: index,
  }));

const gradeOptions = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "U1",
  "U2",
  "U3",
  "U4",
  "U5",
  "U6",
  "UNSPECIFIED",
] as const;

const gradeLabel = (value: (typeof gradeOptions)[number]) => {
  switch (value[0]) {
    case "P":
      return `ประถม ${value.slice(1)}`;
    case "M":
      return `มัธยม ${value.slice(1)}`;
    case "U":
      return `มหาวิทยาลัย ปี ${value.slice(1)}`;
    default:
      return "ไม่ระบุ";
  }
};

export const QuestionForm = ({ initialValues, submitting, onSubmit }: QuestionFormProps) => {
  const [subjectOptions, setSubjectOptions] = useState<Array<{ id: string; name: string; code: string }>>([]);

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionCreateSchema),
    defaultValues:
      initialValues ?? {
        subject: "",
        gradeLevel: "",
        body: "",
        explanation: "",
        shouldRescore: false,
        choices: createDefaultChoices(),
      },
  });

  useEffect(() => {
    form.reset(
      initialValues ?? {
        subject: "",
        gradeLevel: "",
        body: "",
        explanation: "",
        shouldRescore: false,
        choices: createDefaultChoices(),
      },
    );
  }, [initialValues, form]);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("/api/subjects/my", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const json = await response.json();
        if (Array.isArray(json.data)) {
          setSubjectOptions(
            json.data.map((item: { id: string; name: string; code: string }) => ({
              id: item.id,
              name: item.name,
              code: item.code,
            })),
          );
        }
      } catch (error) {
        console.error("Failed to load subjects", error);
      }
    };

    fetchSubjects();
  }, []);

  useEffect(() => {
    if (subjectOptions.length === 0) {
      return;
    }
    const current = form.getValues("subject");
    if (!current) {
      form.setValue("subject", subjectOptions[0].name, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [subjectOptions, form]);

  const errors = form.formState.errors;

  const choices = form.watch("choices");
  const correctIndex = choices.findIndex((choice) => choice.isCorrect);

  const handleSelectCorrect = (index: number) => {
    const choices = form.getValues("choices");
    const updated = choices.map((choice, idx) => ({
      ...choice,
      isCorrect: idx === index,
      order: idx,
    }));
    form.setValue("choices", updated, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          ...values,
          choices: values.choices.map((choice, index) => ({
            ...choice,
            order: index,
          })),
        });
      })}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          วิชา
          {subjectOptions.length > 0 ? (
            <select
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              value={form.watch("subject")}
              onChange={(event) => form.setValue("subject", event.target.value, { shouldDirty: true, shouldValidate: true })}
            >
              <option value="">เลือกวิชา</option>
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.name}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          ) : (
            <Input placeholder="เช่น Mathematics" {...form.register("subject")} />
          )}
          {errors.subject && <span className="text-xs text-destructive">{errors.subject.message}</span>}
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          ระดับชั้น
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
            value={form.watch("gradeLevel")}
            onChange={(event) =>
              form.setValue("gradeLevel", event.target.value, { shouldDirty: true, shouldValidate: true })
            }
          >
            <option value="">เลือกระดับชั้น</option>
            {gradeOptions.map((option) => (
              <option key={option} value={option}>
                {gradeLabel(option)}
              </option>
            ))}
          </select>
          {errors.gradeLevel && (
            <span className="text-xs text-destructive">{errors.gradeLevel.message}</span>
          )}
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium">
        โจทย์
        <textarea
          placeholder="รายละเอียดของคำถาม"
          className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          {...form.register("body")}
        />
        {errors.body && <span className="text-xs text-destructive">{errors.body.message}</span>}
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        คำอธิบายเฉลย
        <textarea
          placeholder="อธิบายแนวคิดหรือขั้นตอน"
          className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          {...form.register("explanation")}
        />
        {errors.explanation && (
          <span className="text-xs text-destructive">{errors.explanation.message}</span>
        )}
      </label>

      <div className="rounded-md border border-dashed p-4">
        <p className="text-sm font-semibold">ตัวเลือกคำตอบ</p>
        <p className="text-xs text-muted-foreground">เลือกคำตอบที่ถูกต้อง 1 ตัวเลือก</p>
        <div className="mt-4 grid gap-3">
          {choices.map((choice, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-md border border-border/70 p-3 md:flex-row md:items-center md:gap-4"
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctChoice"
                  checked={correctIndex === index}
                  onChange={() => handleSelectCorrect(index)}
                />
                <span className="text-sm font-medium">คำตอบ {index + 1}</span>
              </div>
              <div className="flex-1">
                <Input
                  placeholder={`คำตอบตัวเลือกที่ ${index + 1}`}
                  {...form.register(`choices.${index}.text` as const)}
                />
              </div>
            </div>
          ))}
        </div>
        {errors.choices && (
          <span className="mt-2 block text-xs text-destructive">{errors.choices.message}</span>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" {...form.register("shouldRescore")} />
        ต้องการให้ AI ประเมินความยากใหม่ (Rescore)
      </label>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "กำลังบันทึก..." : "บันทึกคำถาม"}
        </Button>
      </div>
    </form>
  );
};
