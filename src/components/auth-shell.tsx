import Image from "next/image";
import Link from "next/link";

// Splits a sentence into words that rise into place one after another.
function Words({ text, start = 0, step = 70 }: { text: string; start?: number; step?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className="word" style={{ animationDelay: `${start + i * step}ms` }}>{w}{i < text.split(" ").length - 1 ? "\u00a0" : ""}</span>
      ))}
    </>
  );
}

const promises = [
  { title: "Only registered students", text: "Every form checks the name and email against the cohort list before it opens." },
  { title: "Only the right links", text: "A Notion link goes in the Notion box. Locked links are turned away with clear steps to fix them." },
  { title: "Marked by people", text: "Moderators read the work and give the score. Nothing is graded automatically." },
];

// The two column layout shared by the sign in and activate pages.
export function AuthShell({ eyebrow, title, intro, children }: {
  eyebrow: string; title: string; intro: string; children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col gap-12 px-6 py-8 sm:px-12 lg:px-16">
        <Image src="/ts-academy-logo.png" alt="TS Academy" width={359} height={79} priority className="h-10 w-auto self-start" />
        <div className="mx-auto my-auto w-full max-w-md pb-8">
          <p className="fade-up font-display text-sm font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
          <h1 className="mt-2 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-navy">
            <Words text="TS Academy Submit" start={120} step={110} />
          </h1>
          <h2 className="fade-up mt-4 font-display text-2xl font-semibold text-navy" style={{ animationDelay: "520ms" }}>{title}</h2>
          <p className="fade-up mt-2 text-lg text-muted" style={{ animationDelay: "620ms" }}>{intro}</p>
          <div className="fade-up mt-8" style={{ animationDelay: "760ms" }}>{children}</div>

          <div className="fade-up mt-12 rounded-2xl bg-navy p-6 text-white lg:hidden" style={{ animationDelay: "900ms" }}>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-sky-deep">Tech Sphere Academy</p>
            <p className="mt-2 font-display text-2xl font-semibold leading-tight">Every submission, checked, kept and marked.</p>
            <ul className="mt-5 flex flex-col gap-4">
              {promises.map((p) => (
                <li key={p.title} className="flex gap-3">
                  <span aria-hidden className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-white/15 text-xs font-semibold">✓</span>
                  <div><p className="font-display font-semibold">{p.title}</p><p className="text-sm text-sky-deep">{p.text}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-navy px-16 py-16 text-white lg:flex lg:flex-col lg:justify-center" aria-label="About TS Academy Submit">
        <div aria-hidden className="drift absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div aria-hidden className="glow absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/40 blur-3xl" />
        <div className="relative max-w-lg">
          <p className="fade-up font-display text-sm font-semibold uppercase tracking-[0.14em] text-sky-deep" style={{ animationDelay: "200ms" }}>Tech Sphere Academy</p>
          <h2 className="mt-4 font-display text-5xl font-semibold leading-[1.08] tracking-tight">
            <Words text="Every submission, checked, kept and marked." start={350} step={90} />
          </h2>
          <ul className="mt-12 flex flex-col gap-7">
            {promises.map((p, i) => (
              <li key={p.title} className="slide-in flex gap-4" style={{ animationDelay: `${1400 + i * 260}ms` }}>
                <span aria-hidden className="pop mt-1 grid h-7 w-7 flex-none place-items-center rounded-full bg-white/15 text-sm font-semibold" style={{ animationDelay: `${1550 + i * 260}ms` }}>✓</span>
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

export function AuthTabs({ active }: { active: "sign-in" | "sign-up" }) {
  const base = "flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition";
  return (
    <nav aria-label="Sign in or sign up" className="mb-6 flex gap-1 rounded-xl bg-sky p-1">
      <Link href="/sign-in" aria-current={active === "sign-in" ? "page" : undefined}
        className={`${base} ${active === "sign-in" ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}>Sign in</Link>
      <Link href="/sign-up" aria-current={active === "sign-up" ? "page" : undefined}
        className={`${base} ${active === "sign-up" ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}>Sign up</Link>
    </nav>
  );
}
