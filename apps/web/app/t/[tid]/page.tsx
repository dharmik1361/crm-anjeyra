import Link from "next/link";
import { QuoteActions } from "@/components/quote-actions";
import { api } from "@/lib/api";
import { ageDays, buyerLabel, fmtDateTime, formatINRShort } from "@/lib/format";
import type { Bucket, Quote } from "@/lib/types";

type Today = {
  summary: { open: Bucket; atRisk: Bucket; won: Bucket; lost: Bucket };
  pending: Array<{ reason: "nudge_due" | "escalated"; dueSince: string; step: number; quote: Quote }>;
};

function Tile({ label, b, tone }: { label: string; b: Bucket; tone?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-2xl font-semibold ${tone ?? ""}`}>{formatINRShort(b.amountPaise)}</div>
      <div className="text-xs text-stone-500">{b.count} quotes</div>
    </div>
  );
}

export default async function TodayPage({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = await params;
  const { summary, pending } = await api<Today>(`/v1/tenants/${tid}/today`);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Open" b={summary.open} />
        <Tile label="At risk (>7 days, no reply)" b={summary.atRisk} tone="text-risk" />
        <Tile label="Won · last 7 days" b={summary.won} tone="text-brand" />
        <Tile label="Lost · last 7 days" b={summary.lost} tone="text-danger" />
      </div>

      <section className="card">
        <h2 className="mb-1 font-medium">Chase list ({pending.length})</h2>
        <p className="mb-4 text-xs text-stone-500">Quotes whose follow-up is due. Escalated ones go to the owner. Mark each one once it is handled.</p>
        {!pending.length && <p className="text-sm text-stone-500">Nothing to chase right now ✅</p>}
        <ul className="divide-y divide-stone-100">
          {pending.map(({ quote: q, reason, step, dueSince }) => (
            <li key={q.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${reason === "escalated" ? "bg-amber-100 text-amber-800" : "bg-sky-50 text-sky-700"}`}>
                    {reason === "escalated" ? "Escalated to owner" : `Nudge ${step + 1}`}
                  </span>
                  <Link href={`/t/${tid}/quotes/${q.id}`} className="font-medium hover:underline">{buyerLabel(q.buyer)}</Link>
                  <span className="text-sm font-semibold">{formatINRShort(q.amountPaise)}</span>
                </div>
                <div className="text-xs text-stone-500">
                  {q.quoteNumber ?? "no quote no."} · {q.repName ?? "rep"} · sent {ageDays(q.sentAt)}d ago · due since {fmtDateTime(dueSince)}
                  {q.buyer.phone && <> · <a className="text-brand underline" href={`https://wa.me/${q.buyer.phone}`} target="_blank" rel="noreferrer">WhatsApp buyer</a></>}
                </div>
              </div>
              <QuoteActions tid={tid} qid={q.id} status={q.status} compact />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
