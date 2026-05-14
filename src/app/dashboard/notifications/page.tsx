import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function markRead(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) return;
  const id = formData.get("id");
  if (id === "ALL") {
    await prisma.notification.updateMany({ where: { userId: session.user.id, read: false }, data: { read: true } });
  } else if (typeof id === "string") {
    await prisma.notification.updateMany({ where: { id, userId: session.user.id }, data: { read: true } });
  }
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}

async function deleteNotif(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) return;
  const id = String(formData.get("id"));
  await prisma.notification.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/dashboard/notifications");
  redirect("/dashboard/notifications");
}

const TYPE_COLORS: Record<string, string> = {
  BOOKING_CONFIRMED: "badge-green",
  BOOKING_CANCELLED: "badge-amber",
  FLOOR_CLOSED: "badge-amber",
  FLOOR_REOPENED: "badge-green",
  ADMIN_MESSAGE: "badge-slate",
  ACCESSIBILITY_REQUEST: "badge-slate",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) return null;
  const items = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = items.filter((i) => !i.read).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unread > 0 && (
          <form action={markRead}>
            <input type="hidden" name="id" value="ALL" />
            <button className="btn-secondary" type="submit">Mark all as read</button>
          </form>
        )}
      </div>
      <div className="card">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((n) => (
              <li key={n.id} className={`p-4 flex items-start justify-between gap-3 flex-wrap ${n.read ? "" : "bg-brand-50 dark:bg-brand-900/10"}`}>
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className={TYPE_COLORS[n.type] ?? "badge-slate"}>{n.type.replaceAll("_", " ")}</span>
                    <span className="font-medium">{n.title}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{n.body}</p>
                  <p className="text-xs text-slate-500">{n.createdAt.toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {!n.read && (
                    <form action={markRead}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className="btn-secondary" type="submit">Mark read</button>
                    </form>
                  )}
                  <form action={deleteNotif}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="btn-danger" type="submit">Delete</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
