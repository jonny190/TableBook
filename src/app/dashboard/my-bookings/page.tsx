import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ACCESSIBILITY_LABELS, formatDate, startOfDay } from "@/lib/utils";
import { cancelBooking } from "@/lib/booking";
import { redirect } from "next/navigation";

async function cancelAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await cancelBooking(id);
  redirect("/dashboard/my-bookings?cancelled=1");
}

export default async function MyBookings({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session) return null;
  const today = startOfDay(new Date());
  const [upcoming, past] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: session.user.id, date: { gte: today } },
      include: { desk: { include: { floor: { include: { building: true } } } } },
      orderBy: { date: "asc" },
    }),
    prisma.booking.findMany({
      where: { userId: session.user.id, date: { lt: today } },
      include: { desk: { include: { floor: { include: { building: true } } } } },
      orderBy: { date: "desc" },
      take: 30,
    }),
  ]);

  const renderList = (items: typeof upcoming, cancellable: boolean) =>
    items.length === 0 ? (
      <p className="p-4 text-sm text-slate-500">No bookings.</p>
    ) : (
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((b) => (
          <li key={b.id} className="p-4 flex justify-between gap-3 flex-wrap items-start">
            <div className="space-y-1">
              <div className="font-medium">
                {formatDate(b.date)} — Desk {b.desk.code} · {b.desk.floor.building.name} · Floor {b.desk.floor.number}
              </div>
              <div className="flex gap-1 flex-wrap">
                <span className={b.status === "CANCELLED" ? "badge-red" : "badge-green"}>{b.status}</span>
                {b.desk.features.map((f) => (
                  <span key={f} className="badge-slate">{ACCESSIBILITY_LABELS[f] ?? f}</span>
                ))}
              </div>
            </div>
            {cancellable && b.status === "CONFIRMED" && (
              <form action={cancelAction}>
                <input type="hidden" name="id" value={b.id} />
                <button className="btn-danger" type="submit">Cancel</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My bookings</h1>
      {sp.cancelled && <div className="card p-3 bg-emerald-50 text-sm">Booking cancelled.</div>}
      <section className="card">
        <h2 className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-semibold">Upcoming</h2>
        {renderList(upcoming, true)}
      </section>
      <section className="card">
        <h2 className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-semibold">History</h2>
        {renderList(past, false)}
      </section>
    </div>
  );
}
