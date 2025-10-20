"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

// Top navigation bar for authenticated areas
export const Navbar = ({
  links,
  userName,
}: {
  links: Array<{ href: string; label: string }>;
  userName?: string | null;
}) => {
  const pathname = usePathname();

  return (
    <header className="flex flex-col gap-3 border-b bg-background px-4 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6">
      {/* Render navigation links */}
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`transition-colors hover:text-primary ${
              pathname.startsWith(link.href) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {/* Render user info and sign out button */}
      <div className="flex flex-wrap items-center gap-3 text-sm sm:justify-end">
        <span className="text-muted-foreground">Hi, {userName ?? "Guest"}</span>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Button>
      </div>
    </header>
  );
};
