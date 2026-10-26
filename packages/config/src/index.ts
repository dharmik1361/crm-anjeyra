import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  MONGO_URL: z.string().optional().transform((v) => (v ? v : undefined)),
  ADMIN_TOKEN: z.string().min(16, "ADMIN_TOKEN must be at least 16 characters"),
  SWEEP_INTERVAL_SEC: z.coerce.number().int().positive().default(60),
  TZ_DEFAULT: z.string().default("Asia/Kolkata"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}
