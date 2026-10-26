import { validateCadence, type CadenceConfig, type WorkCalendar } from "@qf/core";
import { Types } from "mongoose";
import { AuditLog, Tenant, type TenantDoc } from "../models.js";

export interface TenantSettingsPatch {
  name?: string;
  plan?: "concierge" | "team" | "growth";
  status?: "trial" | "active" | "paused" | "exited";
  cadence?: CadenceConfig;
  calendar?: Partial<WorkCalendar>;
  dpaSignedAt?: Date | null;
}

export async function createTenant(input: { name: string; slug: string; plan?: TenantSettingsPatch["plan"] }) {
  const doc = await Tenant.create(input);
  return doc.toObject() as TenantDoc;
}

export async function listTenants() {
  return (await Tenant.find().sort({ createdAt: -1 }).lean()) as TenantDoc[];
}

export async function getTenant(tenantId: string | Types.ObjectId) {
  return (await Tenant.findById(tenantId).lean()) as TenantDoc | null;
}

export async function updateTenantSettings(tenantId: string, patch: TenantSettingsPatch, actor: string) {
  if (patch.cadence) validateCadence(patch.cadence);
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === "calendar") {
      for (const [ck, cv] of Object.entries(v as object)) if (cv !== undefined) set[`calendar.${ck}`] = cv;
    } else set[k] = v;
  }
  const doc = (await Tenant.findByIdAndUpdate(tenantId, { $set: set }, { new: true, runValidators: true }).lean()) as
    | TenantDoc
    | null;
  if (doc) await AuditLog.create({ tenantId, actor, action: "tenant.update", meta: { fields: Object.keys(set) } });
  return doc;
}

/** Cadence and calendar in the shape @qf/core expects. */
export function tenantRules(t: TenantDoc): { cadence: CadenceConfig; calendar: WorkCalendar } {
  return {
    cadence: { steps: [...t.cadence!.steps], escalateAfter: t.cadence!.escalateAfter! },
    calendar: {
      workdays: [...t.calendar!.workdays],
      holidays: [...t.calendar!.holidays],
      quietStart: t.calendar!.quietStart!,
      quietEnd: t.calendar!.quietEnd!,
      reminderTime: t.calendar!.reminderTime!,
    },
  };
}
