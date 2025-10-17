import { redirect } from "next/navigation";

// Redirect teacher base route to question bank
export default function TeacherIndexPage() {
  redirect("/teacher/questions");
}
