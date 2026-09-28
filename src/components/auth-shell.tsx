import Image from "next/image";

const promises = [
  { title: "Only registered students", text: "Every form checks the name and email against the cohort list before it opens." },
  { title: "Only the right links", text: "A Notion link goes in the Notion box. Locked links are turned away with clear steps to fix them." },
  { title: "Marked by people", text: "Moderators read the work and give the score. Nothing is graded automatically." },
];

// The two column layout shared by the sign in and activate pages.
export function AuthShell({ eyebrow, title, intro, children, footer }: {
  eyebrow: string; title: string; intro: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col justify-between gap-12 px-6 py-8 sm:px-12 lg:px-16">
        <Image src="/ts-academy-logo.png" alt="TS Academy" width={359} height={79} priority className="h-10 w-auto self-start" />
        <div className="mx-auto w-full max-w-md">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-navy">{title}</h1>
          <p className="mt-3 text-lg text-muted">{intro}</p>
          <div className="mt-8">{children}</div>
        </div>
        <p className="mx-auto w-full max-w-md text-sm text-muted">{footer ?? "Students do not sign in. They use the form link their moderator sends."}</p>
      </section>

      <aside className="relative hidden overflow-hidden bg-navy px-16 py-16 text-white lg:flex lg:flex-col lg:justify-center" aria-label="About TS Academy Submit">
        <div aria-hidden className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/40 blur-3xl" />
        <div className="relative max-w-lg">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-sky-deep">Tech Sphere Academy</p>
          <h2 className="mt-4 font-display text-5xl font-semibold leading-[1.08] tracking-tight">Every submission, checked, kept and marked.</h2>
          <ul className="mt-12 flex flex-col gap-7">
            {promises.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span aria-hidden className="mt-1 grid h-7 w-7 flex-none place-items-center rounded-full bg-white/15 text-sm font-semibold">✓</span>
                <div>
                  <h3 className="font-display text-xl font-semibold">{p.title}</h3>
                  <p className="mt-1 text-base text-sky-deep">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}

export const inputClass = "w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-base focus:border-brand focus:outline-none";
