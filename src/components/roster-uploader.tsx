"use client";

import { useMemo, useState, useTransition } from "react";
import { importStudents, type ImportResult } from "@/app/actions/students";
import { checkRows, detectColumns, PROBLEM_TEXT } from "@/lib/roster";

type Sheet = { headers: string[]; rows: string[][] };

export function RosterUploader({ cohortCourseId, existingEmails }: { cohortCourseId: string; existingEmails: string[] }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [cols, setCols] = useState({ name: -1, email: -1 });
  const [fileError, setFileError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    setResult(null); setFileError(""); setSheet(null);
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const ws = wb.Sheets[wb.SheetNames[0]];
      const all = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "", raw: false }).filter((r) => r.some((c) => String(c).trim()));
      if (all.length < 2) { setFileError("This file has no students in it. It needs a header row and at least one student."); return; }
      const headers = all[0].map(String);
      setSheet({ headers, rows: all.slice(1).map((r) => headers.map((_, i) => String(r[i] ?? ""))) });
      setCols(detectColumns(headers));
    } catch {
      setFileError("This file could not be read. Use an Excel (.xlsx) or CSV file.");
    }
  }

  const checked = useMemo(() => {
    if (!sheet || cols.name < 0 || cols.email < 0) return [];
    return checkRows(sheet.rows.map((r) => ({ name: r[cols.name], email: r[cols.email] })), existingEmails);
  }, [sheet, cols, existingEmails]);

  const good = checked.filter((r) => r.problem === "ok").length;
  const label = (h: string, i: number) => h.trim() || `Column ${i + 1}`;

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Full name", "Email"]]), "Students");
    XLSX.writeFile(wb, "student-list-template.xlsx");
  }

  const select = "rounded-xl border-[1.5px] border-line bg-white px-3 py-2 focus:border-brand focus:outline-none";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark focus-within:outline focus-within:outline-2">
          Choose a file
          <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button type="button" onClick={downloadTemplate} className="rounded-xl border-[1.5px] border-line px-4 py-2.5 font-semibold text-brand hover:bg-sky">
          Download empty template
        </button>
        <span className="text-sm text-muted">Excel or CSV. Two columns: Full name and Email.</span>
      </div>

      {fileError && <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{fileError}</p>}

      {sheet && !result && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["name", "email"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1.5">
                <label htmlFor={`col-${k}`} className="text-sm font-semibold">Which column has the {k === "name" ? "full names" : "email addresses"}?</label>
                <select id={`col-${k}`} value={cols[k]} className={select} onChange={(e) => setCols({ ...cols, [k]: Number(e.target.value) })}>
                  <option value={-1}>Choose a column</option>
                  {sheet.headers.map((h, i) => <option key={i} value={i}>{label(h, i)}</option>)}
                </select>
              </div>
            ))}
          </div>

          {checked.length > 0 && (
            <>
              <p className="text-sm">
                <span className="font-semibold text-pass">{good} ready to import</span>
                {checked.length - good > 0 && <>, <span className="font-semibold text-fail">{checked.length - good} with a problem</span> (these will be skipped)</>}
              </p>
              <div className="max-h-96 overflow-auto rounded-xl border border-line">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="sticky top-0 bg-sky text-xs uppercase tracking-wide text-muted">
                    <tr><th className="px-3 py-2">Full name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Check</th></tr>
                  </thead>
                  <tbody>
                    {checked.slice(0, 300).map((r, i) => (
                      <tr key={i} className={r.problem === "ok" ? "" : "bg-[#fbe9e6]"}>
                        <td className="border-t border-line px-3 py-2">{r.name || "-"}</td>
                        <td className="border-t border-line px-3 py-2">{r.email || "-"}</td>
                        <td className={`border-t border-line px-3 py-2 font-medium ${r.problem === "ok" ? "text-pass" : "text-fail"}`}>{r.problem === "ok" ? "Ready" : PROBLEM_TEXT[r.problem]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {checked.length > 300 && <p className="text-sm text-muted">Showing the first 300 rows. All {checked.length} rows are checked and will be imported.</p>}
              <button type="button" disabled={pending || good === 0}
                onClick={() => start(async () => setResult(await importStudents(cohortCourseId, checked.map((r) => ({ name: r.name, email: r.email })))))}
                className="self-start rounded-xl bg-brand px-5 py-3 font-display font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                {pending ? "Importing..." : `Import ${good} student${good === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </>
      )}

      {result?.error && <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{result.error}</p>}
      {result && !result.error && (
        <div role="status" className="rounded-xl bg-[#e1f2e9] px-4 py-3 text-sm text-pass">
          <p className="font-semibold">{result.added} student{result.added === 1 ? "" : "s"} added.</p>
          {result.skipped?.map((s) => <p key={s.reason}>{s.count} skipped: {s.reason.toLowerCase()}</p>)}
          <button type="button" className="mt-2 font-semibold underline" onClick={() => { setSheet(null); setResult(null); }}>Upload another file</button>
        </div>
      )}
    </div>
  );
}
