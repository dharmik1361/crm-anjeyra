import { login } from "@/app/actions";
import { ActionForm } from "@/components/forms";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-lg font-semibold">QuoteFollow console</h1>
        <p className="mb-4 text-sm text-stone-500">Founder access. Har quotation ka follow-up, bina bhoole.</p>
        <ActionForm action={login} className="space-y-3">
          <label className="label" htmlFor="token">Admin token</label>
          <input id="token" name="token" type="password" className="input" autoFocus required />
          <button className="btn-primary w-full">Sign in</button>
        </ActionForm>
      </div>
    </main>
  );
}
