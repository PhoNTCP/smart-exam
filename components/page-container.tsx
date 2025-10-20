import { cn } from "@/lib/utils";

// Shared wrapper for page content
export const PageContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <section className={cn("flex flex-1 flex-col gap-6 p-4 sm:p-6", className)}>{children}</section>;
};
