import { NextResponse } from "next/server";
import { read, utils } from "xlsx";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { questionCreateSchema } from "@/lib/validators/question";

const RowSchema = z.object({
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  body: z.string().min(1),
  explanation: z.string().min(1),
  choiceA: z.string().min(1),
  choiceB: z.string().min(1),
  choiceC: z.string().min(1),
  choiceD: z.string().min(1),
  correctChoice: z.string().min(1),
  shouldRescore: z.union([z.string(), z.boolean()]).optional(),
});

const normalizeBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n", ""].includes(normalized)) {
      return false;
    }
  }
  return false;
};

const correctIndexFromLabel = (label: string) => {
  const normalized = label.trim().toUpperCase();
  const mapping: Record<string, number> = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
    "1": 0,
    "2": 1,
    "3": 2,
    "4": 3,
  };
  return mapping[normalized] ?? null;
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ message: "กรุณาอัปโหลดไฟล์ Excel" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return NextResponse.json({ message: "ไม่พบข้อมูลในไฟล์" }, { status: 400 });
    }

    const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
      blankrows: false,
    });
    if (rows.length === 0) {
      return NextResponse.json({ message: "ไฟล์ไม่มีข้อมูล" }, { status: 400 });
    }

    const results: Array<{
      row: number;
      status: "success" | "error";
      message?: string;
      raw?: Record<string, unknown>;
      errors?: string[];
    }> = [];
    let successCount = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const raw = rows[index];
      const parsedRow = RowSchema.safeParse({
        subject: raw.subject ?? raw.Subject,
        gradeLevel: raw.gradeLevel ?? raw.GradeLevel,
        body: raw.body ?? raw.Body,
        explanation: raw.explanation ?? raw.Explanation,
        choiceA: raw.choiceA ?? raw.ChoiceA,
        choiceB: raw.choiceB ?? raw.ChoiceB,
        choiceC: raw.choiceC ?? raw.ChoiceC,
        choiceD: raw.choiceD ?? raw.ChoiceD,
        correctChoice: raw.correctChoice ?? raw.CorrectChoice,
        shouldRescore: raw.shouldRescore ?? raw.ShouldRescore,
      });

      if (!parsedRow.success) {
        results.push({
          row: index + 2,
          status: "error",
          message: "ข้อมูลไม่ครบถ้วน",
          raw,
          errors: parsedRow.error.issues.map((issue) => issue.message),
        });
        continue;
      }

      const data = parsedRow.data;
      const correctIndex = correctIndexFromLabel(data.correctChoice);
      if (correctIndex === null) {
        results.push({
          row: index + 2,
          status: "error",
          message: "ระบุคำตอบที่ถูกต้องไม่ถูกต้อง (ใช้ A-D)",
          raw,
        });
        continue;
      }

      const payload = {
        subject: String(data.subject).trim(),
        gradeLevel: String(data.gradeLevel).trim(),
        body: String(data.body).trim(),
        explanation: String(data.explanation).trim(),
        shouldRescore: normalizeBoolean(data.shouldRescore),
        choices: [
          { text: String(data.choiceA).trim(), isCorrect: correctIndex === 0, order: 0 },
          { text: String(data.choiceB).trim(), isCorrect: correctIndex === 1, order: 1 },
          { text: String(data.choiceC).trim(), isCorrect: correctIndex === 2, order: 2 },
          { text: String(data.choiceD).trim(), isCorrect: correctIndex === 3, order: 3 },
        ],
      };

      const validated = questionCreateSchema.safeParse(payload);
      if (!validated.success) {
        results.push({
          row: index + 2,
          status: "error",
          message: "ข้อมูลไม่ผ่านการตรวจสอบ",
          raw,
          errors: validated.error.issues.map((issue) => issue.message),
        });
        continue;
      }

      try {
        await prisma.question.create({
          data: {
            subject: validated.data.subject,
            gradeLevel: validated.data.gradeLevel,
            body: validated.data.body,
            explanation: validated.data.explanation,
            shouldRescore: validated.data.shouldRescore ?? false,
            createdById: session.user.id,
            choices: {
              create: validated.data.choices.map((choice, idx) => ({
                text: choice.text,
                isCorrect: choice.isCorrect,
                order: idx,
              })),
            },
          },
        });
        successCount += 1;
        results.push({ row: index + 2, status: "success" });
      } catch (error) {
        console.error("Failed to import row", index + 2, error);
        results.push({
          row: index + 2,
          status: "error",
          message: "บันทึกลงฐานข้อมูลไม่สำเร็จ",
          raw,
        });
      }
    }

    return NextResponse.json({
      imported: successCount,
      total: rows.length,
      results,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "ไม่สามารถนำเข้าคำถามได้" }, { status: 500 });
  }
}
