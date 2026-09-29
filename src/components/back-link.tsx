import Link from "next/link";

// A clear "go back" button with an arrow. The text says where it goes.
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-sky">
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 8H3M7.5 3.5 3 8l4.5 4.5" />
      </svg>
      <span>Back to {children}</span>
    </Link>
  );
}
