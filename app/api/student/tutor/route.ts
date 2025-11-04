import { NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incrementAiUsage } from "@/lib/services/ai-usage";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(1000),
});

const requestSchema = z
  .object({
    messages: z.array(messageSchema).min(1).max(12),
    questionId: z.string().cuid().optional(),
    attemptId: z.string().cuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.questionId && !value.attemptId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "attemptId is required when providing a questionId",
        path: ["attemptId"],
      });
    }
  });

const buildQuestionContext = (params: {
  subject: string;
  gradeLevel: string;
  body: string;
  hint: string | null;
  choices: Array<{ text: string }>;
}) => {
  const parts = [
    "Exam question context:",
    `• Subject: ${params.subject}`,
    `• Grade Level: ${params.gradeLevel}`,
    `• Question: ${params.body}`,
    "• Choices:",
    ...params.choices.map((choice, index) => `   ${index + 1}. ${choice.text}`),
  ];

  if (params.hint) {
    parts.push(`• System Hint: ${params.hint}`);
  }

  parts.push(
    "",
    "Important tutoring rules:",
    "- Do NOT reveal the exact correct answer or letter.",
    "- Provide gentle hints, guiding questions, or step-by-step reasoning support.",
    "- Encourage the student to think critically and explain the concept in simple language.",
    "- If the student asks for the answer directly, remind them you can only give hints.",
  );

  return parts.join("\n");
};

type GeminiMessage = {
  role: "user" | "assistant";
  content: string;
};

const callGeminiTutor = async (input: {
  systemPrompt: string;
  messages: GeminiMessage[];
  modelName: string;
}) => {
  const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const captureContext = input.messages.find(
    (message) => message.role === "user" && message.content.startsWith("Exam question context:"),
  );

  let selected = input.messages.slice(-12);
  if (captureContext && !selected.includes(captureContext)) {
    selected = [captureContext, ...selected.slice(-11)];
  }

  const contents = selected.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const response = await client.models.generateContent({
    model: input.modelName,
    systemInstruction: {
      role: "system",
      parts: [{ text: input.systemPrompt }],
    },
    contents,
  });

  return response.text?.trim() ?? "";
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "student" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const raw = await request.json();
    const body = requestSchema.parse(raw);

    const latest = body.messages.at(-1);
    if (!latest || latest.role !== "user") {
      return NextResponse.json({ message: "Latest message must be from student." }, { status: 400 });
    }

    let systemPrompt =
      [
        "You are SmartExam Tutor, an encouraging AI learning companion for students.",
        "Keep responses short (under 6 sentences) and conversational.",
        "Always explain concepts with relatable examples or step-by-step reasoning.",
        "Avoid giving direct exam answers, numeric results, or option letters.",
        "If the student requests the exact answer, politely decline and offer strategy tips instead.",
        "For non-exam questions, be a friendly educational assistant.",
      ].join("\n");

    if (process.env.NODE_ENV !== "production") {
      console.info("[TutorChat] Received payload meta:", {
        questionId: body.questionId,
        attemptId: body.attemptId,
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[TutorChat] Received payload meta:", {
        questionId: body.questionId,
        attemptId: body.attemptId,
      });
    }

    let questionContext: string | null = null;

    if (body.questionId && body.attemptId) {
      const attempt = await prisma.examAttempt.findFirst({
        where: {
          id: body.attemptId,
          userId: session.user.id,
        },
        include: {
          exam: true,
          answers: {
            where: { questionId: body.questionId },
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!attempt) {
        return NextResponse.json({ message: "Question unavailable for this attempt." }, { status: 404 });
      }

      const question = await prisma.question.findFirst({
        where: {
          id: body.questionId,
          createdById: attempt.exam.createdById,
        },
        include: {
          choices: {
            select: { text: true, order: true },
            orderBy: { order: "asc" },
          },
          aiScores: {
            select: { difficulty: true, reason: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!question) {
        return NextResponse.json({ message: "Question unavailable." }, { status: 404 });
      }

      const hasAccess =
        attempt.exam.createdById === question.createdById &&
        (attempt.answers.length > 0 || attempt.currentQuestionId === question.id);

      if (!hasAccess) {
        return NextResponse.json({ message: "Question not accessible." }, { status: 404 });
      }

      systemPrompt = [
        systemPrompt,
        "",
        (questionContext = buildQuestionContext({
          subject: question.subject,
          gradeLevel: question.gradeLevel,
          body: question.body,
          hint: question.aiScores[0]?.reason ?? null,
          choices: question.choices.map((choice) => ({ text: choice.text })),
        })) ?? "",
      ].join("\n");

      if (process.env.NODE_ENV !== "production") {
        console.info("[TutorChat] Attached question context for AI.");
      }
    }

    const aiDailyLimit = Number(process.env.AI_MAX_CALLS_PER_DAY ?? "0");
    const usage = incrementAiUsage(aiDailyLimit);
    if (!usage.allowed) {
      return NextResponse.json(
        {
          message: "ขออภัย วันนี้มีการใช้งานผู้ช่วย AI เกินโควตาแล้ว",
        },
        { status: 429 },
      );
    }

    const provider = process.env.AI_PROVIDER?.toLowerCase();
    if (provider !== "gemini" || !process.env.GEMINI_API_KEY) {
      const fallback = [
        "ระบบผู้ช่วย AI ไม่พร้อมใช้งานในขณะนี้",
        "โปรดลองอีกครั้งภายหลัง หรือทบทวนโจทย์ด้วยตนเองก่อน",
      ].join("\n");
      return NextResponse.json({ reply: fallback, remaining: usage.remaining });
    }

    const modelName = process.env.AI_MODEL ?? "gemini-2.5-flash";
    const messagesForModel: GeminiMessage[] = questionContext
      ? [{ role: "user", content: questionContext }, ...body.messages]
      : body.messages;

    if (process.env.NODE_ENV !== "production") {
      console.info("[TutorChat] System prompt:", systemPrompt);
      console.info(
        "[TutorChat] Messages:",
        JSON.stringify(
          messagesForModel.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          null,
          2,
        ),
      );
    }

    const reply = await callGeminiTutor({
      systemPrompt,
      messages: messagesForModel,
      modelName,
    });

    if (!reply) {
      return NextResponse.json(
        {
          reply:
            "ฉันไม่สามารถสร้างคำแนะนำได้ในตอนนี้ ลองถามใหม่อีกครั้ง หรือทบทวนจากคำใบ้ของระบบก่อนนะ",
          remaining: usage.remaining,
        },
      );
    }

    return NextResponse.json({
      reply,
      remaining: usage.remaining,
    });
  } catch (error) {
    console.error("Tutor chat error:", error);
    return NextResponse.json(
      { message: "ไม่สามารถเชื่อมต่อผู้ช่วย AI ได้ในขณะนี้" },
      { status: 500 },
    );
  }
}
