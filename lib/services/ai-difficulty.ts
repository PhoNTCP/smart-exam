import { GoogleGenAI } from "@google/genai";

type ScoreInput = {
  subject: string;
  gradeLevel: string;
  body: string;
};

type ScoreResult = {
  difficulty: number;
  reason: string;
  modelName: string;
};
const clampDifficulty = (value: number) => Math.min(5, Math.max(1, Math.round(value)));

const extractGradeLevel = (gradeLevel: string) => {
  const match = gradeLevel.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const heuristicScore = (input: ScoreInput, provider?: string): ScoreResult => {
  const wordCount = input.body.split(/\s+/).filter(Boolean).length;
  const gradeLevel = extractGradeLevel(input.gradeLevel);
  const subjectHint =
    /math|คณิต|algebra|calculus/i.test(input.subject) || /equation|integral/i.test(input.body) ? 1 : 0;
  const scienceHint =
    /physics|chemistry|science|ชีว|ฟิสิกส์/i.test(input.subject) || /velocity|energy|atom/i.test(input.body)
      ? 1
      : 0;

  const baseFromGrade = gradeLevel ? Math.ceil(Math.min(5, Math.max(1, gradeLevel / 3))) : 2;
  const baseFromLength = clampDifficulty(wordCount / 40);
  const randomness = Math.random() * 0.6 - 0.2;
  const combined = (baseFromGrade + baseFromLength + subjectHint + scienceHint) / 2 + randomness;
  const difficulty = clampDifficulty(combined);
  const reason = [
    `ประเมินจากความยาว ${wordCount} คำและระดับ ${input.gradeLevel}`,
    subjectHint + scienceHint > 0 ? "พบคำสำคัญเชิงเทคนิคบางส่วน" : "ไม่มีคำสำคัญเชิงเทคนิคเด่นชัด",
    "ใช้ heuristic ภายในระบบ (fallback)",
  ].join(" | ");

  return {
    difficulty,
    reason,
    modelName: "Local-System",
  };
};

const extractJson = (raw: string) => {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as { difficulty?: number; reason?: string };
  } catch (error) {
    console.error("Failed to parse Gemini response JSON", error);
    return null;
  }
};

export const scoreWithAI = async (input: ScoreInput): Promise<ScoreResult> => {
  const provider = process.env.AI_PROVIDER?.toLowerCase();

  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    const modelName = process.env.AI_MODEL ?? "gemini-2.5-flash";
    try {
      const client = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });
      console.info(`[AI] Gemini difficulty scoring using model "${modelName}"`);
      const prompt = [
        "คุณคือผู้เชี่ยวชาญด้านการออกแบบแบบทดสอบ",
        "โปรดให้คะแนนความยากของคำถามต่อไปนี้อยู่ในช่วง 1 (ง่ายมาก) ถึง 5 (ยากมาก) โดยพิจารณาจากวิชา ระดับชั้น และภาษาที่ใช้",
        "ตอบกลับด้วย JSON เท่านั้น ในรูปแบบ {\"difficulty\": number, \"reason\": string}",
        "",
        `วิชา: ${input.subject}`,
        `ระดับชั้น: ${input.gradeLevel}`,
        `คำถาม: ${input.body}`,
      ].join("\n");

      const response = await client.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: {
          // ensure JSON style output if supported
          responseMimeType: "application/json",
        },
      });

      const rawText = response.text ?? "";
      const parsed = extractJson(rawText);

      if (parsed?.difficulty) {
        console.info("[AI] Gemini difficulty scoring succeeded");
        return {
          difficulty: clampDifficulty(parsed.difficulty),
          reason: parsed.reason ?? "AI ประเมินความยากเรียบร้อย",
          modelName,
        };
      }

      console.warn("Gemini response missing expected fields, fallback to heuristic");
      return heuristicScore(input, provider);
    } catch (error) {
      console.error("Gemini scoring failed, fallback to heuristic", error);
      return heuristicScore(input, provider);
    }
  }

  if (provider === "gemini" && !process.env.GEMINI_API_KEY) {
    console.warn("Gemini provider selected but GEMINI_API_KEY is missing. Using heuristic fallback.");
  }

  return heuristicScore(input, provider);
};
