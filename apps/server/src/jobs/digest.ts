import { formatINRShort, summarize, type QuoteStatus } from "@qf/core";
import { Quote, getTenant, listPendingFollowUps, listUsers, type QuoteDoc } from "@qf/db";
import { Types } from "mongoose";

export async function tenantSnapshot(tenantId: string, now = new Date()) {
  const tenant = await getTenant(tenantId);
  if (!tenant) return null;
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const [users, quotes, pending] = await Promise.all([
    listUsers(tenantId),
    Quote.find({
      tenantId: new Types.ObjectId(tenantId),
      $or: [{ status: { $in: ["open", "replied", "escalated"] } }, { closedAt: { $gte: since } }],
    })
      .select({ status: 1, amountPaise: 1, sentAt: 1, repId: 1, closedAt: 1 })
      .lean() as Promise<QuoteDoc[]>,
    listPendingFollowUps(tenantId),
  ]);
  const summary = summarize(
    quotes.map((q) => ({
      status: q.status as QuoteStatus,
      amountPaise: q.amountPaise,
      sentAt: q.sentAt,
      repId: String(q.repId),
      closedAt: q.closedAt,
    })),
    now,
    since,
  );
  return { tenant, users, summary, pending };
}

/**
 * The founder's morning list while running concierge. M1 sends this over WhatsApp; in S0 it
 * is logged by the worker and shown on the console dashboard.
 */
export function formatDigest(snap: NonNullable<Awaited<ReturnType<typeof tenantSnapshot>>>): string {
  const names = new Map(snap.users.map((u) => [String(u._id), u.name]));
  const { summary: s, pending } = snap;
  const lines = [
    `*${snap.tenant.name}*`,
    `Open ${formatINRShort(s.open.amountPaise)} (${s.open.count}) · At risk ${formatINRShort(s.atRisk.amountPaise)} (${s.atRisk.count})`,
    `Won 7d ${formatINRShort(s.won.amountPaise)} · Lost 7d ${formatINRShort(s.lost.amountPaise)}`,
  ];
  if (!pending.length) lines.push("Nothing to chase today ✅");
  for (const p of pending.slice(0, 15)) {
    const q = p.quote;
    const tag = p.reason === "escalated" ? "⚠️ ESCALATED" : `Nudge ${p.step + 1}`;
    lines.push(
      `• ${tag} · ${formatINRShort(q.amountPaise)} · ${q.buyer?.company ?? q.buyer?.name ?? "Buyer"}${q.quoteNumber ? ` · ${q.quoteNumber}` : ""} · ${names.get(String(q.repId)) ?? "rep"}`,
    );
  }
  if (pending.length > 15) lines.push(`…and ${pending.length - 15} more in the console`);
  return lines.join("\n");
}
