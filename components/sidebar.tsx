"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Sidebar navigation for dashboard layouts
export const Sidebar = ({
  title,
  links,
  className,
}: {
  title: string;
  links: Array<{ href: string; label: string; icon?: React.ReactNode }>;
  className?: string;
}) => {
  const pathname = usePathname();

  return (
    <aside className={cn("flex w-60 flex-col gap-4 border-r bg-muted/30 p-6", className)}>
      {/* Render section title */}
      <h2 className="text-lg font-semibold">{title}</h2>
      {/* Render navigation links */}
      <div className="flex flex-col gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
              pathname.startsWith(link.href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </div>
    </aside>
  );
};
