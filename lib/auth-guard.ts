import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Guards server components by enforcing authentication and optional role
export const authGuard = async (role?: "teacher" | "student") => {
  const session = await auth();

  // Redirect anonymous visitors to login
  if (!session?.user) {
    redirect("/login");
  }

  // Enforce role-based access when provided
  if (role && session.user.role !== role) {
    const fallback = session.user.role === "teacher" ? "/teacher/questions" : "/student/exams";
    redirect(fallback);
  }

  return session.user;
};
