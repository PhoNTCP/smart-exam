"use client";

import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TutorChat } from "@/components/student/tutor-chat";
import { useTutorChatContext } from "@/components/student/tutor-context";

export const TutorWidget = () => {
  const { attemptId, questionId, isOpen, setOpen, pendingPrompt, consumePrompt } = useTutorChatContext();

  const contextual = Boolean(attemptId && questionId);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="pointer-events-auto h-[80vh] w-[min(22rem,90vw)] rounded-lg border bg-background shadow-2xl sm:w-[26rem]">
          <div className="relative h-full">
            <TutorChat
              className="h-full"
              attemptId={contextual ? attemptId : undefined}
              questionId={contextual ? questionId : undefined}
              autoPrompt={pendingPrompt}
              onAutoPromptConsumed={consumePrompt}
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* {!contextual && (
            <div className="border-t bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">ไอเดียที่น่าลอง</p>
              <ul className="list-disc space-y-1 pl-4">
                {tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )} */}
        </div>
      )}

      <Button
        type="button"
        size="lg"
        onClick={() => setOpen(!isOpen)}
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full shadow-lg",
          isOpen ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-primary text-primary-foreground",
        )}
      >
        <MessageCircle className="h-4 w-4" />
        {isOpen ? "ปิด SmartExam Tutor" : "เปิด SmartExam Tutor"}
        {contextual && <span className="ml-1 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">Exam</span>}
      </Button>
    </div>
  );
};
