import Link from "next/link";
import { QuoteActions } from "@/components/quote-actions";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { buyerLabel, fmtDate, fmtDateTime, formatINR } from "@/lib/format";
import type { Quote } from "@/lib/types";

type Detail = { quote: Quote; events: Array<{ id: string; type: string; at: string; meta: Record<string, unknown> }> };

const EVENT_LABEL: Record<string, string> = {
  logged: "Logged",
  confirmed: "Confirmed — cadence started",
  edited: "Edited",
  nudge_due: "Follow-up due",
  rep_marked_sent: "Follow-up sent",
  buyer_replied: "Buyer replied — cadence paused",
  outcome_won: "Won 🎉",
  outcome_lost: "Lost",
  outcome_revised: "Revised",
  snoozed: "Snoozed",
  escalated: "Escalated to owner",
};

export default async function QuoteDetail({ params }: { params: Promise<{ tid: string; qid: string }> }) {
  const { tid, qid } = await params;
  const { quote: q, events } = await api<Detail>(`/v1/tenants/${tid}/quotes/${qid}`);
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <section className="card space-y-4 md:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{buyerLabel(q.buyer)}</h2>
            <div className="text-sm text-stone-500">{q.quoteNumber ?? "No quote number"} · {q.repName}</div>
          </div>
          <StatusBadge status={q.status} />
        </div>
        <div className="text-3xl font-semibold">{formatINR(q.amountPaise)}</div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-stone-500">Contact</dt><dd>{q.buyer.name ?? "—"}</dd>
          <dt className="text-stone-500">Phone</dt>
          <dd>{q.buyer.phone ? <a className="text-brand underline" href={`https://wa.me/${q.buyer.phone}`} target="_blank" rel="noreferrer">{q.buyer.phone}</a> : "—"}</dd>
          <dt className="text-stone-500">Sent</dt><dd>{fmtDate(q.sentAt)}</dd>
          <dt className="text-stone-500">Source</dt><dd className="capitalize">{q.source}</dd>
          <dt className="text-stone-500">Next action</dt><dd>{fmtDateTime(q.nextActionAt)}</dd>
          {q.lostReason && (<><dt className="text-stone-500">Lost reason</dt><dd className="capitalize">{q.lostReason.replace("_", " ")}</dd></>)}
          {q.revisedFromId && (<><dt className="text-stone-500">Revision of</dt><dd><Link className="underline" href={`/t/${tid}/quotes/${q.revisedFromId}`}>earlier quote</Link></dd></>)}
          {q.notes && (<><dt className="text-stone-500">Notes</dt><dd>{q.notes}</dd></>)}
        </dl>
        <QuoteActions tid={tid} qid={q.id} status={q.status} />
      </section>
      <section className="card">
        <h3 className="mb-3 font-medium">History</h3>
        <ol className="space-y-2 border-l border-stone-200 pl-4 text-sm">
          {events.map((e) => (
            <li key={e.id}>
              <div>{EVENT_LABEL[e.type] ?? e.type}{e.type === "nudge_due" && typeof e.meta.step === "number" ? ` (step ${e.meta.step + 1})` : ""}</div>
              <div className="text-xs text-stone-500">{fmtDateTime(e.at)}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
