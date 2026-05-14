import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, startOfDay } from "@/lib/utils";

export default async function DashboardHome() {
  const session = await auth();
  if (!session) return null;
  const today = startOfDay(new Date());

  const [upcomingBookings, openFloors, closedFloors, unreadNotifications] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: session.user.id, status: "CONFIRMED", date: { gte: today } },
      include: { desk: { include: { floor: { include: { building: true } } } } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.floor.count({ where: { active: true } }),
    prisma.floor.count({ where: { active: false } }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hi {session.user.name ?? session.user.email} 👋</h1>
        <p className="text-slate-600 dark:text-slate-400">Welcome back to TableBook.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Your upcoming bookings" value={upcomingBookings.length} />
        <Stat label="Floors open" value={openFloors} />
        <Stat label="Floors shut down" value={closedFloors} accent={closedFloors ? "amber" : "slate"} />
        <Stat label="Unread notifications" value={unreadNotifications} accent={unreadNotifications ? "amber" : "slate"} />
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Your next bookings</h2>
          <Link className="text-brand-600 text-sm hover:underline" href="/dashboard/book">Book another →</Link>
        </div>
        {upcomingBookings.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming bookings. <Link className="text-brand-600 hover:underline" href="/dashboard/book">Book a desk</Link>.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {upcomingBookings.map((b) => (
              <li key={b.id} className="py-2 text-sm flex justify-between gap-3 flex-wrap">
                <span>
                  <strong>{formatDate(b.date)}</strong> — Desk <strong>{b.desk.code}</strong>, {b.desk.floor.building.name} · Floor {b.desk.floor.number}
                </span>
                <Link href="/dashboard/my-bookings" className="text-brand-600 hover:underline">manage</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent = "slate" }: { label: string; value: number; accent?: "slate" | "amber" | "green" }) {
  const color = accent === "amber" ? "text-amber-600" : accent === "green" ? "text-emerald-600" : "text-slate-900 dark:text-slate-100";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
