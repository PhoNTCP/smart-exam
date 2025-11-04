"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTutorChatContext } from "@/components/student/tutor-context";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type TutorChatProps = {
  attemptId?: string;
  questionId?: string;
  className?: string;
  autoPrompt?: string | null;
  onAutoPromptConsumed?: () => void;
};

const createId = () => Math.random().toString(36).slice(2);

const initialGreeting: ChatMessage = {
  id: createId(),
  role: "assistant",
  content:
    "สวัสดี! ฉันคือ SmartExam Tutor พร้อมช่วยอธิบายและให้คำใบ้ได้ทุกเมื่อ บอกฉันได้เลยว่าต้องการความช่วยเหลือเรื่องอะไรนะ",
};

export const TutorChat = ({ attemptId, questionId, className, autoPrompt, onAutoPromptConsumed }: TutorChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting]);
  const [input, setInput] = useState("");
  const { isSending, setSending } = useTutorChatContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isContextual = Boolean(attemptId && questionId);

  const canSend = input.trim().length > 0 && !pending;

  const sendMessage = useCallback(async (override?: string) => {
    const trimmedSource = override ?? input;
    const trimmed = trimmedSource.trim();
    if (!trimmed || pending || isSending) {
      return;
    }
    setPending(true);
    setSending(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };

    let nextMessages: ChatMessage[] = [];
    setMessages((prev) => {
      nextMessages = [...prev, userMessage];
      return nextMessages.slice(-12);
    });
    if (!override) {
      setInput("");
    } else {
      setInput((prev) => (prev === trimmedSource ? "" : prev));
    }

    const historyMessages = nextMessages.length > 0 ? nextMessages : [userMessage];

    try {
      const payload: {
        messages: Array<{ role: "assistant" | "user"; content: string }>;
        questionId?: string;
        attemptId?: string;
      } = {
        messages: historyMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      };

      if (isContextual && questionId && attemptId) {
        payload.questionId = questionId;
        payload.attemptId = attemptId;
      }

      const response = await fetch("/api/student/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.message ?? "ไม่สามารถติดต่อผู้ช่วย AI ได้");
      }

      const json = await response.json();
      const reply: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: json.reply ?? "ฉันยังตอบไม่ได้ในตอนนี้ ลองถามใหม่อีกครั้งนะ",
      };

      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ");
      setMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
      if (!override) {
        setInput(trimmed);
      }
    } finally {
      setPending(false);
      setSending(false);
    }
  }, [attemptId, isContextual, isSending, pending, questionId, input, setSending]);

  useEffect(() => {
    if (!autoPrompt) {
      return;
    }

    let cancelled = false;
    const trigger = async () => {
      try {
        await sendMessage(autoPrompt);
      } finally {
        if (!cancelled) {
          onAutoPromptConsumed?.();
        }
      }
    };

    void trigger();

    return () => {
      cancelled = true;
    };
  }, [autoPrompt, onAutoPromptConsumed, sendMessage]);

  return (
    <div className={cn("flex h-full flex-col rounded-lg border bg-card shadow-sm", className)}>
      <div className="border-b p-4">
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-foreground">SmartExam Tutor</p>
          <p className="text-xs text-muted-foreground">
            ระบบนี้ไม่เก็บประวัติการสนทนาไว้ในฐานข้อมูล บทสนทนาจะหายไปเมื่อปิดหน้าจอ
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {isContextual ? (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                กำลังเชื่อมกับคำถามข้อสอบปัจจุบัน (AI จะให้คำใบ้ ไม่เฉลยตรงๆ)
              </span>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1">
                โหมดสนทนาทั่วไป (ไม่มีข้อมูลข้อสอบแนบไป)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex flex-col gap-1", message.role === "user" ? "items-end text-right" : "items-start")}
          >
            <span className="text-xs uppercase text-muted-foreground">
              {message.role === "user" ? "นักเรียน" : "SmartExam Tutor"}
            </span>
            <div
              className={cn(
                "max-w-[90%] whitespace-pre-wrap rounded-md border px-3 py-2 leading-relaxed",
                message.role === "user"
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-muted bg-muted text-foreground",
              )}
            >
              {message.content}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex flex-col gap-1 items-start">
            <span className="text-xs uppercase text-muted-foreground">SmartExam Tutor</span>
            <div className="flex items-center gap-2 rounded-md border border-muted bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>กำลังคิดคำตอบให้อยู่นะ...</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <form
        className="border-t p-4"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <div className="flex flex-col gap-2">
          <textarea
            rows={3}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="พิมพ์คำถามหรือขอคำใบ้จากผู้ช่วย AI..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {isContextual ? "AI จะอ้างอิงคำถามข้อสอบเพื่อให้คำใบ้" : "สนทนาในโหมดทั่วไป ไม่อ้างอิงข้อสอบ"}
            </span>
            <Button type="submit" size="sm" disabled={!canSend}>
              {pending ? "กำลังส่ง..." : "ส่งข้อความ"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
