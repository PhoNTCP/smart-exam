import { redirect } from "next/navigation";

// Redirect student base route to upcoming exams
export default function StudentIndexPage() {
  redirect("/student/exams");
}
