"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type TutorContextState = {
  attemptId?: string;
  questionId?: string;
};

type TutorContextValue = TutorContextState & {
  setContext: (value: TutorContextState) => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  openWithPrompt: (prompt: string) => void;
  pendingPrompt: string | null;
  consumePrompt: () => void;
  isSending: boolean;
  setSending: (value: boolean) => void;
};

const TutorChatContext = createContext<TutorContextValue | undefined>(undefined);

export const TutorChatProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<TutorContextState>({});
  const [isOpen, setIsOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const setContext = useCallback((value: TutorContextState) => {
    setState(value);
  }, []);

  const setOpen = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setPendingPrompt(null);
    }
  }, []);

  const openWithPrompt = useCallback((prompt: string) => {
    if (isSending) {
      return;
    }
    setPendingPrompt(prompt);
    setIsOpen(true);
  }, [isSending]);

  const consumePrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  const value = useMemo<TutorContextValue>(
    () => ({
      attemptId: state.attemptId,
      questionId: state.questionId,
      setContext,
      isOpen,
      setOpen,
      openWithPrompt,
      pendingPrompt,
      consumePrompt,
      isSending,
      setSending: setIsSending,
    }),
    [
      consumePrompt,
      isOpen,
      isSending,
      openWithPrompt,
      pendingPrompt,
      setContext,
      setOpen,
      state.attemptId,
      state.questionId,
    ],
  );

  return <TutorChatContext.Provider value={value}>{children}</TutorChatContext.Provider>;
};

export const useTutorChatContext = () => {
  const context = useContext(TutorChatContext);
  if (!context) {
    throw new Error("useTutorChatContext must be used within a TutorChatProvider");
  }
  return context;
};
