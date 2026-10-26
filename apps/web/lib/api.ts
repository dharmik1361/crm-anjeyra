import "server-only";

// Server-side only: the admin token never reaches the browser.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      body?.message ??
      body?.issues?.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("; ") ??
      `API ${res.status}`;
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}
