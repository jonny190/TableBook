import { prisma } from "@/lib/db";
import { ACCESSIBILITY_LABELS } from "@/lib/utils";
import { updateUser, sendAdminMessage } from "@/lib/admin";
import { redirect } from "next/navigation";

async function setRole(fd: FormData) {
  "use server";
  const id = String(fd.get("id"));
  const role = String(fd.get("role")) as "USER" | "ADMIN" | "REPORTER";
  await updateUser(id, { role });
  redirect("/dashboard/admin/users");
}
async function toggleActive(fd: FormData) {
  "use server";
  const id = String(fd.get("id"));
  const active = fd.get("active") === "true";
  await updateUser(id, { active: !active });
  redirect("/dashboard/admin/users");
}
async function broadcast(fd: FormData) {
  "use server";
  const title = String(fd.get("title") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  if (!title || !body) return;
  const ids = (await prisma.user.findMany({ where: { active: true }, select: { id: true } })).map((u) => u.id);
  await sendAdminMessage(ids, title, body);
  redirect("/dashboard/admin/users?broadcast=1");
}

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ broadcast?: string }> }) {
  const sp = await searchParams;
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>

      <form action={broadcast} className="card p-4 space-y-3">
        <h2 className="font-semibold">Broadcast a message to all active users</h2>
        {sp.broadcast && <p className="text-sm text-emerald-600">Sent.</p>}
        <input className="input" name="title" placeholder="Title" required />
        <textarea className="input" name="body" rows={3} placeholder="Body" required />
        <button className="btn-primary" type="submit">Send</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-left">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Role</th>
              <th className="p-3">Accessibility needs</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="p-3">
                  <div className="font-medium">{u.name ?? "—"}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="p-3">
                  <form action={setRole} className="flex gap-2 items-center">
                    <input type="hidden" name="id" value={u.id} />
                    <select className="input" name="role" defaultValue={u.role}>
                      <option value="USER">USER</option>
                      <option value="REPORTER">REPORTER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button className="btn-secondary" type="submit">Save</button>
                  </form>
                </td>
                <td className="p-3 max-w-xs">
                  {u.needs.length === 0 ? <span className="text-slate-400">none</span> :
                    u.needs.map((n) => <span key={n} className="badge-slate mr-1 mb-1 inline-block">{ACCESSIBILITY_LABELS[n] ?? n}</span>)}
                </td>
                <td className="p-3">
                  <span className={u.active ? "badge-green" : "badge-red"}>{u.active ? "Active" : "Disabled"}</span>
                </td>
                <td className="p-3">
                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="active" value={String(u.active)} />
                    <button className="btn-secondary" type="submit">{u.active ? "Disable" : "Enable"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
