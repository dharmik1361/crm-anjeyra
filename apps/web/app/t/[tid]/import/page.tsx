import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { Importer } from "./importer";

export default async function ImportPage({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = await params;
  const { items } = await api<{ items: User[] }>(`/v1/tenants/${tid}/users`);
  return <Importer tid={tid} reps={items.map((u) => ({ id: u.id, name: u.name }))} />;
}
