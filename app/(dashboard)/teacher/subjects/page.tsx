import { authGuard } from "@/lib/auth-guard";
import { SubjectManager } from "@/components/teacher/subject-manager";

export default async function TeacherSubjectsPage() {
  await authGuard("teacher");
  return <SubjectManager />;
}

