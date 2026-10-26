import Link from "next/link";
import { createTenant, logout } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import { api } from "@/lib/api";

type T = { id: string; name: string; slug: string; plan: string; status: string };

export default async function Home() {
  const { items } = await api<{ items: T[] }>("/v1/tenants");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Clients</h1>
          <p className="text-sm text-stone-500">Concierge cap is 3 clients — founder hours are the constraint.</p>
        </div>
        <form action={logout}><button className="btn-ghost">Sign out</button></form>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((t) => (
          <Link key={t.id} href={`/t/${t.id}`} className="card hover:border-brand">
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-stone-500">{t.slug} · {t.plan} · {t.status}</div>
          </Link>
        ))}
        {!items.length && <p className="text-sm text-stone-500">No clients yet.</p>}
      </div>

      <section className="card mt-8">
        <h2 className="mb-3 font-medium">Add client</h2>
        <ActionForm action={createTenant} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div className="sm:col-span-2"><label className="label">Company name</label><input name="name" className="input" required /></div>
          <div><label className="label">Slug</label><input name="slug" className="input" placeholder="patel-chem" pattern="[a-z0-9-]{2,40}" required /></div>
          <div>
            <label className="label">Plan</label>
            <select name="plan" className="input" defaultValue="concierge">
              <option value="concierge">Concierge</option><option value="team">Team</option><option value="growth">Growth</option>
            </select>
          </div>
          <button className="btn-primary sm:col-span-4 sm:justify-self-start">Create client</button>
        </ActionForm>
      </section>
    </main>
  );
}
