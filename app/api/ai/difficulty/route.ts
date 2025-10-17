import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incrementAiUsage } from "@/lib/services/ai-usage";
import { scoreWithAI } from "@/lib/services/ai-difficulty";

const bodySchema = z.object({
  questionId: z.string().cuid(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher" || !session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { questionId } = bodySchema.parse(body);

    const limit = Number(process.env.AI_MAX_CALLS_PER_DAY ?? "500");
    const usage = incrementAiUsage(limit);
    if (!usage.allowed) {
      return NextResponse.json({ message: "Queued for nightly batch" }, { status: 429 });
    }

    const question = await prisma.question.findFirst({
      where: { id: questionId, createdById: session.user.id },
      select: {
        id: true,
        subject: true,
        gradeLevel: true,
        body: true,
      },
    });

    if (!question) {
      return NextResponse.json({ message: "ไม่พบคำถาม" }, { status: 404 });
    }

    const result = await scoreWithAI({
      subject: question.subject,
      gradeLevel: question.gradeLevel,
      body: question.body,
    });

    const aiScore = await prisma.aiScore.create({
      data: {
        questionId,
        difficulty: result.difficulty,
        reason: result.reason,
        modelName: result.modelName,
      },
    });

    await prisma.question.update({
      where: { id: questionId },
      data: { shouldRescore: false },
    });

    return NextResponse.json({
      data: {
        questionId,
        difficulty: aiScore.difficulty,
        reason: aiScore.reason,
        modelName: aiScore.modelName,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "ข้อมูลไม่ถูกต้อง", issues: error.flatten() },
        { status: 422 },
      );
    }
    return NextResponse.json({ message: "ไม่สามารถประเมินความยากได้" }, { status: 500 });
  }
}
