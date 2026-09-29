import Link from "next/link";

const ITEMS = [
  ["", "Overview"],
  ["submissions", "Submissions"],
  ["not-submitted", "Not submitted"],
  ["resubmissions", "Resubmissions"],
  ["requests", "Requests"],
  ["students", "Students"],
  ["tasks", "Tasks"],
] as const;

// The pages inside one course. On a small phone the buttons wrap onto two rows, so none are hidden.
export function CourseNav({ base, active, pending = 0, resubmit = 0 }: { base: string; active: string; pending?: number; resubmit?: number }) {
  return (
    <nav aria-label="Pages in this course">
      <ul className="flex flex-wrap gap-1">
        {ITEMS.map(([path, label]) => (
          <li key={path}>
            <Link href={path ? `${base}/${path}` : base} aria-current={active === path ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold ${active === path ? "bg-brand text-white" : "text-navy hover:bg-sky-deep"}`}>
              {label}
              {path === "resubmissions" && resubmit > 0 && <span className="rounded-full bg-brand px-1.5 text-xs text-white">{resubmit}</span>}
              {path === "requests" && pending > 0 && <span className="rounded-full bg-fail px-1.5 text-xs text-white">{pending}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
