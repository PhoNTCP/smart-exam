import { authGuard } from "@/lib/auth-guard";
import { QuestionManager } from "@/components/teacher/question-manager";

export default async function TeacherQuestionsPage() {
  await authGuard("teacher");
  return <QuestionManager />;
}
