import { normalizePhone } from "@qf/core";
import { Tenant, User, type UserDoc } from "../models.js";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export async function createUser(
  tenantId: string,
  input: { name: string; phone: string; role: "owner" | "rep" | "coordinator"; email?: string; language?: "gu" | "hi" | "en" },
) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new ValidationError(`Invalid phone number: ${input.phone}`);
  const user = await User.create({ ...input, tenantId, phone });
  if (input.role === "owner") await Tenant.updateOne({ _id: tenantId, ownerUserId: null }, { ownerUserId: user._id });
  return user.toObject() as UserDoc;
}

export async function listUsers(tenantId: string) {
  return (await User.find({ tenantId }).sort({ role: 1, name: 1 }).lean()) as UserDoc[];
}

/** Find a rep by name (case-insensitive) or phone within a tenant — used by imports. */
export async function findUserByNameOrPhone(tenantId: string, value: string) {
  const phone = normalizePhone(value);
  if (phone) {
    const byPhone = (await User.findOne({ tenantId, phone }).lean()) as UserDoc | null;
    if (byPhone) return byPhone;
  }
  const escaped = value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (await User.findOne({ tenantId, name: new RegExp(`^${escaped}$`, "i") }).lean()) as UserDoc | null;
}
