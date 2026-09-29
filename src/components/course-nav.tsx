import Link from "next/link";

const ITEMS = [
  ["", "Overview"],
  ["submissions", "Submissions"],
  ["not-submitted", "Not submitted"],
  ["requests", "Requests"],
  ["students", "Students"],
  ["tasks", "Tasks"],
] as const;

// The row of pages inside one course. It scrolls sideways on a small phone.
export function CourseNav({ base, active, pending = 0 }: { base: string; active: string; pending?: number }) {
  return (
    <nav aria-label="Pages in this course" className="-mx-1 overflow-x-auto pb-1">
      <ul className="flex min-w-max gap-1 px-1">
        {ITEMS.map(([path, label]) => (
          <li key={path}>
            <Link href={path ? `${base}/${path}` : base} aria-current={active === path ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold ${active === path ? "bg-brand text-white" : "text-navy hover:bg-sky-deep"}`}>
              {label}
              {path === "requests" && pending > 0 && <span className="rounded-full bg-fail px-1.5 text-xs text-white">{pending}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
