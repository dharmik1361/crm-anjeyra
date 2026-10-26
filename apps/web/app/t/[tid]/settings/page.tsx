import { addUser, saveSettings } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import { api } from "@/lib/api";
import type { Tenant, User } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SettingsPage({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = await params;
  const [t, { items: users }] = await Promise.all([
    api<Tenant>(`/v1/tenants/${tid}`),
    api<{ items: User[] }>(`/v1/tenants/${tid}/users`),
  ]);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="card">
        <h2 className="mb-3 font-medium">People</h2>
        <ul className="mb-4 divide-y divide-stone-100 text-sm">
          {users.map((u) => (
            <li key={u.id} className="flex justify-between py-2">
              <span>{u.name} <span className="text-xs capitalize text-stone-500">· {u.role}</span></span>
              <span className="text-stone-500">+{u.phone}</span>
            </li>
          ))}
          {!users.length && <li className="py-2 text-stone-500">Add the owner first, then each salesperson.</li>}
        </ul>
        <ActionForm action={addUser.bind(null, tid)} resetOnOk className="grid grid-cols-2 gap-3">
          <div><label className="label">Name</label><input name="name" className="input" required /></div>
          <div><label className="label">WhatsApp number</label><input name="phone" className="input" placeholder="98250 12345" required /></div>
          <div>
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue={users.some((u) => u.role === "owner") ? "rep" : "owner"}>
              <option value="owner">Owner</option><option value="rep">Salesperson</option><option value="coordinator">Coordinator</option>
            </select>
          </div>
          <div>
            <label className="label">Language</label>
            <select name="language" className="input" defaultValue="gu">
              <option value="gu">Gujarati</option><option value="hi">Hindi</option><option value="en">English</option>
            </select>
          </div>
          <button className="btn-primary col-span-2 justify-self-start">Add person</button>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="mb-3 font-medium">Follow-up rules</h2>
        <ActionForm action={saveSettings.bind(null, tid)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Reminder days (working days after sending)</label><input name="steps" className="input" defaultValue={t.cadence.steps.join(", ")} /></div>
            <div><label className="label">Escalate to owner after last step (days)</label><input name="escalateAfter" type="number" min={0} max={10} className="input" defaultValue={t.cadence.escalateAfter} /></div>
          </div>
          <div>
            <span className="label">Working days</span>
            <div className="flex flex-wrap gap-3 text-sm">
              {DAYS.map((d, i) => (
                <label key={d} className="flex items-center gap-1"><input type="checkbox" name="workdays" value={i} defaultChecked={t.calendar.workdays.includes(i)} /> {d}</label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Quiet from</label><input name="quietStart" type="time" className="input" defaultValue={t.calendar.quietStart} /></div>
            <div><label className="label">Quiet until</label><input name="quietEnd" type="time" className="input" defaultValue={t.calendar.quietEnd} /></div>
            <div><label className="label">Send held reminders at</label><input name="reminderTime" type="time" className="input" defaultValue={t.calendar.reminderTime} /></div>
          </div>
          <div><label className="label">Holidays (YYYY-MM-DD, comma separated)</label><textarea name="holidays" rows={3} className="input font-mono text-xs" defaultValue={t.calendar.holidays.join(", ")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Plan</label>
              <select name="plan" className="input" defaultValue={t.plan}>
                <option value="concierge">Concierge · ₹2,999</option><option value="team">Team · ₹3,999</option><option value="growth">Growth · ₹6,999</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input" defaultValue={t.status}>
                <option value="trial">Trial</option><option value="active">Active</option><option value="paused">Paused</option><option value="exited">Exited</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="dpaSigned" defaultChecked={!!t.dpaSignedAt} />
            Data processing agreement signed {t.dpaSignedAt && <span className="text-xs text-stone-500">({t.dpaSignedAt.slice(0, 10)})</span>}
            {t.dpaSignedAt && <input type="hidden" name="dpaSignedAt" value={t.dpaSignedAt} />}
          </label>
          <button className="btn-primary">Save rules</button>
        </ActionForm>
      </section>
    </div>
  );
}
