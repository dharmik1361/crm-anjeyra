import Link from "next/link";
import { addQuote } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { ageDays, buyerLabel, fmtDate, fmtDateTime, formatINR } from "@/lib/format";
import type { Quote, User } from "@/lib/types";

const AGE: Record<string, [number?, number?]> = { "0-7": [0, 7], "8-14": [8, 14], "15-30": [15, 30], "30+": [31, undefined] };

export default async function QuotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tid: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tid } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  const status = sp.status ?? "open,replied,escalated";
  if (status !== "all") qs.set("status", status);
  if (sp.repId) qs.set("repId", sp.repId);
  if (sp.search) qs.set("search", sp.search);
  const [minAge, maxAge] = AGE[sp.age ?? ""] ?? [];
  if (minAge !== undefined) qs.set("minAgeDays", String(minAge));
  if (maxAge !== undefined) qs.set("maxAgeDays", String(maxAge));

  const [{ items, total }, { items: users }] = await Promise.all([
    api<{ items: Quote[]; total: number }>(`/v1/tenants/${tid}/quotes?${qs}`),
    api<{ items: User[] }>(`/v1/tenants/${tid}/users`),
  ]);
  const reps = users.filter((u) => u.role !== "owner" || users.length === 1);
  const sum = items.reduce((a, q) => a + q.amountPaise, 0);

  return (
    <div className="space-y-6">
      <form className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={status} className="input">
            <option value="open,replied,escalated">Active</option>
            <option value="escalated">Escalated</option>
            <option value="replied">Replied</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="all">All</option>
          </select>
        </div>
        <div>
          <label className="label">Salesperson</label>
          <select name="repId" defaultValue={sp.repId ?? ""} className="input">
            <option value="">Everyone</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Age</label>
          <select name="age" defaultValue={sp.age ?? ""} className="input">
            <option value="">Any</option>
            {Object.keys(AGE).map((a) => <option key={a} value={a}>{a} days</option>)}
          </select>
        </div>
        <div className="grow">
          <label className="label">Search</label>
          <input name="search" defaultValue={sp.search ?? ""} placeholder="Buyer, company, quote no., phone" className="input" />
        </div>
        <button className="btn-primary">Filter</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-stone-100 px-4 py-2 text-xs text-stone-500">
          {total} quotes · {formatINR(sum)} shown
        </div>
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs text-stone-500">
            <tr>
              <th className="px-4 py-2">Buyer</th><th className="px-4 py-2">Quote no.</th><th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2">Rep</th><th className="px-4 py-2">Sent</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Next action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((q) => (
              <tr key={q.id} className="hover:bg-stone-50">
                <td className="px-4 py-2"><Link className="font-medium hover:underline" href={`/t/${tid}/quotes/${q.id}`}>{buyerLabel(q.buyer)}</Link></td>
                <td className="px-4 py-2 text-stone-600">{q.quoteNumber ?? "—"}</td>
                <td className="px-4 py-2 text-right font-medium">{formatINR(q.amountPaise)}</td>
                <td className="px-4 py-2">{q.repName ?? "—"}</td>
                <td className="px-4 py-2">{fmtDate(q.sentAt)} <span className="text-xs text-stone-400">({ageDays(q.sentAt)}d)</span></td>
                <td className="px-4 py-2"><StatusBadge status={q.status} /></td>
                <td className="px-4 py-2 text-stone-600">{fmtDateTime(q.nextActionAt)}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-500">No quotes match.</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="card">
        <h2 className="mb-3 font-medium">Log a quote</h2>
        {!reps.length ? (
          <p className="text-sm text-stone-500">Add a salesperson in <Link className="underline" href={`/t/${tid}/settings`}>Settings</Link> first.</p>
        ) : (
          <ActionForm action={addQuote.bind(null, tid)} resetOnOk className="grid gap-3 md:grid-cols-4">
            <div><label className="label">Company *</label><input name="company" className="input" required /></div>
            <div><label className="label">Contact person</label><input name="buyerName" className="input" /></div>
            <div><label className="label">Buyer phone</label><input name="phone" className="input" placeholder="98250 12345" /></div>
            <div><label className="label">Quote no.</label><input name="quoteNumber" className="input" /></div>
            <div><label className="label">Amount *</label><input name="amount" className="input" placeholder="2,45,000 or 2.45 L" required /></div>
            <div><label className="label">Sent on *</label><input name="sentAt" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
            <div>
              <label className="label">Salesperson *</label>
              <select name="repId" className="input" required>{reps.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </div>
            <div><label className="label">Notes</label><input name="notes" className="input" /></div>
            <label className="flex items-center gap-2 text-xs text-stone-600 md:col-span-3"><input type="checkbox" name="allowDuplicate" /> Log even if it looks like a duplicate</label>
            <button className="btn-primary">Log quote</button>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
