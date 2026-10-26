export { formatINR, formatINRShort, LOST_REASONS } from "@qf/core";

const dtf = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });
const dtfTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export const fmtDate = (d: string | Date | null) => (d ? dtf.format(new Date(d)) : "—");
export const fmtDateTime = (d: string | Date | null) => (d ? dtfTime.format(new Date(d)) : "—");
export const ageDays = (d: string | Date) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
export const buyerLabel = (b: { company?: string; name?: string }) => b.company ?? b.name ?? "Unknown buyer";
