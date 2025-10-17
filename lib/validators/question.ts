import { z } from "zod";

// Choice schema for create/update operations
const questionChoiceSchema = z.object({
  id: z.string().cuid().optional(),
  text: z.string().min(1, "กรุณากรอกตัวเลือก"),
  isCorrect: z.boolean(),
  order: z.number().int().min(0).max(10),
});

// Shared base schema for question payloads
const questionBaseSchema = z
  .object({
    subject: z.string().min(1, "กรุณากรอกวิชา"),
    gradeLevel: z.string().min(1, "กรุณากรอกระดับชั้น"),
    body: z.string().min(1, "กรุณากรอกโจทย์"),
    explanation: z.string().min(1, "กรุณากรอกคำอธิบาย"),
    shouldRescore: z.boolean().optional(),
    choices: z.array(questionChoiceSchema).length(4, "ต้องมีช้อยส์ 4 ตัวเลือก"),
  })
  .superRefine((data, ctx) => {
    const hasCorrectChoice = data.choices.some((choice) => choice.isCorrect);
    if (!hasCorrectChoice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ต้องเลือกคำตอบที่ถูกต้องอย่างน้อย 1 ตัวเลือก",
        path: ["choices"],
      });
    }
  });

export const questionCreateSchema = questionBaseSchema;

export const questionUpdateSchema = questionBaseSchema.merge(
  z.object({
    id: z.string().cuid(),
  }),
);

export type QuestionFormValues = z.infer<typeof questionBaseSchema>;
