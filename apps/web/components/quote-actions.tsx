"use client";

import { useActionState, useState } from "react";
import { quoteAction, type ActionState } from "@/app/actions";
import type { QuoteStatus } from "@/lib/types";

const LOST_REASONS: Array<[string, string]> = [
  ["price", "Price"],
  ["delivery_time", "Delivery time"],
  ["competitor", "Went to competitor"],
  ["project_cancelled", "Project cancelled"],
  ["no_response", "No response"],
  ["specs_mismatch", "Specs mismatch"],
  ["other", "Other"],
];

/** Same outcomes a rep gets on WhatsApp: Sent, Buyer replied, Won, Lost, Revised, Snooze. */
export function QuoteActions({ tid, qid, status, compact = false }: { tid: string; qid: string; status: QuoteStatus; compact?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(quoteAction.bind(null, tid, qid), undefined);
  const [mode, setMode] = useState<"lost" | "revised" | "snooze" | null>(null);
  if (!["open", "replied", "escalated"].includes(status)) return null;

  const btn = (type: string, label: string, cls = "btn-ghost") => (
    <button name="type" value={type} className={`${cls} ${compact ? "px-2 py-1 text-xs" : ""}`}>
      {label}
    </button>
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <fieldset disabled={pending} className="contents">
        {mode === null && (
          <>
            {btn("sent", "Sent ✓", "btn-primary")}
            {btn("buyer_replied", "Buyer replied")}
            {btn("won", "Won")}
            <button type="button" className={`btn-ghost ${compact ? "px-2 py-1 text-xs" : ""}`} onClick={() => setMode("lost")}>Lost…</button>
            <button type="button" className={`btn-ghost ${compact ? "px-2 py-1 text-xs" : ""}`} onClick={() => setMode("revised")}>Revised…</button>
            <button type="button" className={`btn-ghost ${compact ? "px-2 py-1 text-xs" : ""}`} onClick={() => setMode("snooze")}>Snooze…</button>
          </>
        )}
        {mode === "lost" && (
          <>
            <select name="reason" className="input w-auto py-1 text-xs" defaultValue="price">
              {LOST_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {btn("lost", "Mark lost", "btn-primary")}
          </>
        )}
        {mode === "revised" && (
          <>
            <input name="amount" placeholder="New amount e.g. 2.3 L" className="input w-36 py-1 text-xs" required />
            {btn("revised", "Save revision", "btn-primary")}
          </>
        )}
        {mode === "snooze" && (
          <>
            <select name="days" className="input w-auto py-1 text-xs" defaultValue="3">
              {[1, 2, 3, 5, 7, 10, 15].map((d) => <option key={d} value={d}>{d} working days</option>)}
            </select>
            {btn("snooze", "Snooze", "btn-primary")}
          </>
        )}
        {mode !== null && (
          <button type="button" className="text-xs text-stone-500 underline" onClick={() => setMode(null)}>cancel</button>
        )}
      </fieldset>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
