import type { QuoteStatus } from "@/lib/types";

const STYLES: Record<QuoteStatus, string> = {
  draft: "bg-stone-100 text-stone-600",
  open: "bg-sky-50 text-sky-700",
  replied: "bg-violet-50 text-violet-700",
  escalated: "bg-amber-50 text-amber-800",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-rose-50 text-rose-700",
  revised: "bg-stone-100 text-stone-600",
};

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STYLES[status]}`}>{status}</span>;
}
