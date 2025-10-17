import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Redirect root route to role dashboard
export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role === "teacher") {
    redirect("/teacher/questions");
  }

  redirect("/student/exams");
}
