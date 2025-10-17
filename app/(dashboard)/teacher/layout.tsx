import { BookOpen, FileBarChart } from "lucide-react";
import { authGuard } from "@/lib/auth-guard";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { PageContainer } from "@/components/page-container";

// Layout wrapper for teacher dashboard routes
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await authGuard("teacher");

  const links = [
    { href: "/teacher/questions", label: "Question Bank", icon: <BookOpen className="h-4 w-4" /> },
    { href: "/teacher/reports", label: "Reports", icon: <FileBarChart className="h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar links={links} userName={user.name} />
      <div className="flex flex-1">
        <Sidebar title="Teacher Portal" links={links} />
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
