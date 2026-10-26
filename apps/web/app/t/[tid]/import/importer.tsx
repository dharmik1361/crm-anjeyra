"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { commitImport } from "@/app/actions";

type Parsed = { fileName: string; headers: string[]; rows: unknown[][]; mapping: Record<string, number>; fields: string[] };
type Result = { dryRun: boolean; total: number; valid?: number; imported?: number; duplicates?: number; errors: Array<{ row: number; message: string }> };

const FIELD_LABEL: Record<string, string> = {
  quoteNumber: "Quote no.",
  buyerName: "Contact person",
  company: "Company *",
  buyerPhone: "Buyer phone",
  buyerEmail: "Buyer email",
  amount: "Amount *",
  sentAt: "Date sent *",
  rep: "Salesperson *",
  status: "Status (open/won/lost)",
  notes: "Notes",
};

export function Importer({ tid, reps }: { tid: string; reps: Array<{ id: string; name: string }> }) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [defaultRep, setDefaultRep] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/import/${tid}`, { method: "POST", body: fd });
    const body = await res.json();
    if (!res.ok) return setError(body.message ?? "Could not read the file");
    setParsed(body);
    setMapping(body.mapping);
  }

  function run(dryRun: boolean) {
    if (!parsed) return;
    start(async () => {
      const res = await commitImport(tid, {
        fileName: parsed.fileName,
        headers: parsed.headers,
        rows: parsed.rows,
        mapping,
        defaultRep: defaultRep || undefined,
        dryRun,
      });
      if (!res.ok) setError(res.error);
      else setResult(res.result as unknown as Result);
    });
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="mb-1 font-medium">Import open quotes</h2>
        <p className="mb-3 text-sm text-stone-500">Upload the client&apos;s Excel or CSV. Day-one concierge setup: every open quote gets a follow-up schedule.</p>
        <input
          type="file"
          accept=".csv,.xlsx"
          className="text-sm"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </section>

      {parsed && (
        <section className="card space-y-4">
          <h3 className="font-medium">Match columns · {parsed.rows.length} rows in {parsed.fileName}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {parsed.fields.map((f) => (
              <div key={f}>
                <label className="label">{FIELD_LABEL[f] ?? f}</label>
                <select
                  className="input"
                  value={mapping[f] ?? ""}
                  onChange={(e) => {
                    const next = { ...mapping };
                    if (e.target.value === "") delete next[f];
                    else next[f] = Number(e.target.value);
                    setMapping(next);
                    setResult(null);
                  }}
                >
                  <option value="">— not in file —</option>
                  {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="label">Salesperson when the column is empty</label>
              <select className="input" value={defaultRep} onChange={(e) => setDefaultRep(e.target.value)}>
                <option value="">— none —</option>
                {reps.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr>{parsed.headers.map((h, i) => <th key={i} className="border-b px-2 py-1 text-left text-stone-500">{h}</th>)}</tr></thead>
              <tbody>
                {parsed.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>{parsed.headers.map((_, j) => <td key={j} className="border-b border-stone-100 px-2 py-1">{String(r[j] ?? "")}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button className="btn-ghost" disabled={pending} onClick={() => run(true)}>Check rows</button>
            <button className="btn-primary" disabled={pending || !result?.dryRun || !result.valid} onClick={() => run(false)}>
              Import {result?.dryRun ? `${result.valid} valid rows` : ""}
            </button>
          </div>

          {result && (
            <div className="rounded-md bg-stone-50 p-3 text-sm">
              {result.dryRun ? (
                <p>{result.valid} of {result.total} rows are ready. {result.errors.length ? "Fix or skip the rows below." : ""}</p>
              ) : (
                <p className="text-brand">
                  Imported {result.imported} quotes{result.duplicates ? `, skipped ${result.duplicates} duplicates` : ""}.{" "}
                  <Link href={`/t/${tid}/quotes`} className="underline">View quotes →</Link>
                </p>
              )}
              {!!result.errors.length && (
                <ul className="mt-2 max-h-64 overflow-y-auto text-xs text-danger">
                  {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
