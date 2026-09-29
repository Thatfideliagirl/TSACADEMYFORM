// A delete area that asks the person to type the name first, so nothing is deleted by accident.
export function DangerZone({ title, warning, confirmWord, action, children, buttonLabel }: {
  title: string; warning: string; confirmWord: string; action: (f: FormData) => void | Promise<void>;
  children: React.ReactNode; buttonLabel: string;
}) {
  return (
    <details className="rounded-2xl border border-[#e8b9b2] bg-white p-5">
      <summary className="cursor-pointer font-display text-lg font-semibold text-fail">{title}</summary>
      <form action={action} className="mt-4 flex flex-col gap-3">
        {children}
        <p className="text-sm text-muted">{warning}</p>
        <label htmlFor="confirm" className="text-sm font-semibold">Type <span className="rounded bg-sky px-1.5 py-0.5">{confirmWord}</span> to confirm</label>
        <input id="confirm" name="confirm" required autoComplete="off"
          className="rounded-xl border-[1.5px] border-line px-3 py-2 focus:border-fail focus:outline-none" />
        <button className="self-start rounded-xl bg-fail px-5 py-2.5 font-display font-semibold text-white hover:opacity-90">{buttonLabel}</button>
      </form>
    </details>
  );
}
