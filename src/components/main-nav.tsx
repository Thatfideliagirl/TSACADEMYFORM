"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The main menu. The page you are on is highlighted. On a phone it scrolls sideways if it does not fit.
export function MainNav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = [
    ["/dashboard", "Overview", (p: string) => p === "/dashboard"],
    ["/dashboard/cohorts", "Cohorts", (p: string) => p.startsWith("/dashboard/cohorts")],
    ...(admin ? [
      ["/dashboard/courses", "Courses", (p: string) => p.startsWith("/dashboard/courses")],
      ["/dashboard/people", "People", (p: string) => p.startsWith("/dashboard/people")],
    ] : []),
  ] as [string, string, (p: string) => boolean][];
  return (
    <nav aria-label="Main" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 text-sm font-semibold">
      {items.map(([href, label, active]) => (
        <Link key={href} href={href} aria-current={active(path) ? "page" : undefined}
          className={`whitespace-nowrap rounded-lg px-3.5 py-2 ${active(path) ? "bg-brand text-white" : "text-navy hover:bg-sky-deep"}`}>{label}</Link>
      ))}
    </nav>
  );
}
