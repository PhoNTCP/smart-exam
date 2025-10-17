import { GraduationCap, LineChart } from "lucide-react";
import { authGuard } from "@/lib/auth-guard";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { PageContainer } from "@/components/page-container";

// Layout wrapper for student dashboard routes
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await authGuard("student");

  const links = [
    { href: "/student/exams", label: "Upcoming Exams", icon: <GraduationCap className="h-4 w-4" /> },
    { href: "/student/progress", label: "Progress", icon: <LineChart className="h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar links={links} userName={user.name} />
      <div className="flex flex-1">
        <Sidebar title="Student Hub" links={links} />
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
