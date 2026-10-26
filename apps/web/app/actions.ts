"use server";

import { parseAmountToPaise } from "@qf/core";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, api } from "@/lib/api";

export type ActionState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

async function guard(fn: () => Promise<void | string>): Promise<ActionState> {
  try {
    const ok = await fn();
    return { ok: ok ?? "Saved" };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  if (str(form, "token") !== process.env.ADMIN_TOKEN) return { error: "Wrong token" };
  (await cookies()).set("qf_admin", process.env.ADMIN_TOKEN!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 86_400,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete("qf_admin");
  redirect("/login");
}

export async function createTenant(_: ActionState, form: FormData): Promise<ActionState> {
  let id = "";
  const res = await guard(async () => {
    const r = await api<{ id: string }>("/v1/tenants", {
      method: "POST",
      json: { name: str(form, "name"), slug: str(form, "slug"), plan: str(form, "plan") },
    });
    id = r.id;
  });
  if (res?.error) return res;
  redirect(`/t/${id}/settings`);
}

export async function addUser(tid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const res = await guard(async () => {
    await api(`/v1/tenants/${tid}/users`, {
      method: "POST",
      json: { name: str(form, "name"), phone: str(form, "phone"), role: str(form, "role"), language: str(form, "language") },
    });
    return "User added";
  });
  revalidatePath(`/t/${tid}`, "layout");
  return res;
}

export async function saveSettings(tid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const steps = (str(form, "steps") ?? "")
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  const holidays = (str(form, "holidays") ?? "").split(/[,\s]+/).filter(Boolean);
  const workdays = form.getAll("workdays").map(Number);
  const res = await guard(async () => {
    await api(`/v1/tenants/${tid}`, {
      method: "PATCH",
      json: {
        plan: str(form, "plan"),
        status: str(form, "status"),
        cadence: { steps, escalateAfter: Number(str(form, "escalateAfter") ?? 2) },
        calendar: {
          workdays,
          holidays,
          quietStart: str(form, "quietStart"),
          quietEnd: str(form, "quietEnd"),
          reminderTime: str(form, "reminderTime"),
        },
        dpaSignedAt: form.get("dpaSigned") ? (str(form, "dpaSignedAt") ?? new Date().toISOString()) : null,
      },
    });
    return "Settings saved";
  });
  revalidatePath(`/t/${tid}`, "layout");
  return res;
}

export async function addQuote(tid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const amountPaise = parseAmountToPaise(str(form, "amount") ?? "");
  if (!amountPaise) return { error: "Amount not understood — try 245000, 2,45,000 or 2.45 L" };
  const res = await guard(async () => {
    await api(`/v1/tenants/${tid}/quotes`, {
      method: "POST",
      json: {
        repId: str(form, "repId"),
        buyer: { company: str(form, "company"), name: str(form, "buyerName"), phone: str(form, "phone") },
        quoteNumber: str(form, "quoteNumber"),
        amountPaise,
        sentAt: new Date(`${str(form, "sentAt")}T12:00:00+05:30`).toISOString(),
        notes: str(form, "notes"),
        allowDuplicate: form.get("allowDuplicate") === "on",
      },
    });
    return "Quote logged";
  });
  revalidatePath(`/t/${tid}`, "layout");
  return res;
}

export async function quoteAction(tid: string, qid: string, _: ActionState, form: FormData): Promise<ActionState> {
  const type = str(form, "type");
  let payload: Record<string, unknown> = { type };
  if (type === "lost") payload.reason = str(form, "reason") ?? "other";
  if (type === "snooze") payload.days = Number(str(form, "days") ?? 3);
  if (type === "revised") {
    const amountPaise = parseAmountToPaise(str(form, "amount") ?? "");
    if (!amountPaise) return { error: "Enter the revised amount" };
    payload = { type, amountPaise };
  }
  const res = await guard(async () => {
    await api(`/v1/tenants/${tid}/quotes/${qid}/actions`, { method: "POST", json: payload });
    return "Updated";
  });
  revalidatePath(`/t/${tid}`, "layout");
  return res;
}

export async function commitImport(tid: string, payload: unknown) {
  try {
    const res = await api<Record<string, unknown>>(`/v1/tenants/${tid}/import/commit`, { method: "POST", json: payload });
    revalidatePath(`/t/${tid}`, "layout");
    return { ok: true as const, result: res };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false as const, error: e.message };
    throw e;
  }
}
