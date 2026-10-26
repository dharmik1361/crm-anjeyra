import Link from "next/link";
import { api } from "@/lib/api";
import type { Tenant } from "@/lib/types";

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tid: string }> }) {
  const { tid } = await params;
  const t = await api<Tenant>(`/v1/tenants/${tid}`);
  const links = [
    ["", "Today"],
    ["/quotes", "Quotes"],
    ["/import", "Import"],
    ["/settings", "Settings"],
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-stone-500 hover:underline">← All clients</Link>
          <h1 className="text-xl font-semibold">{t.name}</h1>
          {!t.dpaSignedAt && <p className="text-xs text-risk">Processing agreement (DPA) not signed yet — required before go-live.</p>}
        </div>
        <nav className="flex gap-1">
          {links.map(([href, label]) => (
            <Link key={href} href={`/t/${tid}${href}`} className="btn-ghost">{label}</Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
