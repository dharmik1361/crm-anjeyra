import type { QuoteDoc, UserDoc } from "@qf/db";

/** API shape: string ids, amounts in both paise and rupees for convenience. */
export function quoteDto(q: QuoteDoc & { revisionId?: string }, reps?: Map<string, UserDoc>) {
  const rep = reps?.get(String(q.repId));
  return {
    id: String(q._id),
    tenantId: String(q.tenantId),
    repId: String(q.repId),
    repName: rep?.name ?? null,
    buyer: q.buyer ?? {},
    quoteNumber: q.quoteNumber ?? null,
    amountPaise: q.amountPaise,
    items: q.items ?? [],
    sentAt: q.sentAt,
    source: q.source,
    status: q.status,
    lostReason: q.lostReason ?? null,
    cadenceStep: q.cadenceStep,
    nextActionAt: q.nextActionAt ?? null,
    closedAt: q.closedAt ?? null,
    revisedFromId: q.revisedFromId ? String(q.revisedFromId) : null,
    revisionId: q.revisionId ?? null,
    notes: q.notes ?? null,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

export function userDto(u: UserDoc) {
  return {
    id: String(u._id),
    tenantId: String(u.tenantId),
    name: u.name,
    phone: u.phone,
    email: u.email ?? null,
    role: u.role,
    language: u.language,
    active: u.active,
  };
}
