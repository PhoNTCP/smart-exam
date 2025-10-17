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
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      {/* Render navigation links */}
      <nav className="flex items-center gap-4 text-sm font-medium">
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
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Hi, {userName ?? "Guest"}</span>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </Button>
      </div>
    </header>
  );
};
