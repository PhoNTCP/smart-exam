"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

// Wraps children with NextAuth SessionProvider on the client
export const AuthSessionProvider = ({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) => {
  return <SessionProvider session={session}>{children}</SessionProvider>;
};
