import { prisma } from "@/lib/db";
import { ACCESSIBILITY_LABELS, isoDate, startOfDay } from "@/lib/utils";

function daysAgo(n: number) {
  const d = startOfDay(new Date());
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
function daysAhead(n: number) {
  const d = startOfDay(new Date());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const from = startOfDay(sp.from ?? daysAgo(30));
  const to = startOfDay(sp.to ?? daysAhead(7));

  const [bookings, totalDesks, bookableDesks, floors, activeShutdowns] = await Promise.all([
    prisma.booking.findMany({
      where: { date: { gte: from, lte: to } },
      include: { desk: { include: { floor: { include: { building: true } } } } },
    }),
    prisma.desk.count(),
    prisma.desk.count({ where: { bookable: true } }),
    prisma.floor.findMany({ include: { _count: { select: { desks: true } }, shutdowns: { orderBy: { startsAt: "desc" } } } }),
    prisma.floorShutdown.findMany({ where: { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }, include: { floor: { include: { building: true } } } }),
  ]);

  const confirmed = bookings.filter((b) => b.status !== "CANCELLED");
  const cancellations = bookings.length - confirmed.length;

  // Day-level occupancy
  const byDay = new Map<string, number>();
  for (const b of confirmed) {
    const k = isoDate(b.date);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Accessibility utilisation
  const featureRequests = new Map<string, number>();
  const featureSupply = new Map<string, number>();
  for (const b of confirmed) for (const f of b.requestedFeatures) featureRequests.set(f, (featureRequests.get(f) ?? 0) + 1);
  const allDesks = await prisma.desk.findMany({ where: { bookable: true } });
  for (const d of allDesks) for (const f of d.features) featureSupply.set(f, (featureSupply.get(f) ?? 0) + 1);

  // Estimated energy savings (kWh) from completed shutdowns in range
  const shutdowns = await prisma.floorShutdown.findMany({
    where: { startsAt: { lte: to } },
    include: { floor: true },
  });
  let totalKwh = 0;
  for (const s of shutdowns) {
    const start = s.startsAt > from ? s.startsAt : from;
    const end = s.endsAt && s.endsAt < to ? s.endsAt : to;
    if (end <= start) continue;
    const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
    if (s.estimatedKwhPerDay) totalKwh += days * s.estimatedKwhPerDay;
  }

  const occupancyRate = bookableDesks > 0 && days.length > 0
    ? (confirmed.length / (bookableDesks * Math.max(1, days.length))) * 100
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <form className="card p-4 flex flex-wrap items-end gap-3" method="get">
        <label className="block"><span className="text-sm">From</span><input className="input mt-1" type="date" name="from" defaultValue={isoDate(from)} /></label>
        <label className="block"><span className="text-sm">To</span><input className="input mt-1" type="date" name="to" defaultValue={isoDate(to)} /></label>
        <button className="btn-primary" type="submit">Update</button>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total desks" value={totalDesks} />
        <Stat label="Bookable desks" value={bookableDesks} />
        <Stat label="Confirmed bookings" value={confirmed.length} />
        <Stat label="Cancellations" value={cancellations} accent={cancellations ? "amber" : "slate"} />
        <Stat label="Avg occupancy" value={`${occupancyRate.toFixed(1)}%`} />
        <Stat label="Floors shut down (currently)" value={activeShutdowns.length} accent={activeShutdowns.length ? "amber" : "slate"} />
        <Stat label="Est. kWh saved (range)" value={totalKwh.toFixed(1)} accent="green" />
        <Stat label="Days in range" value={Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000))} />
      </div>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Daily bookings</h2>
        {days.length === 0 ? <p className="text-sm text-slate-500">No data in range.</p> : (
          <div className="space-y-1">
            {(() => {
              const max = Math.max(...days.map(([, v]) => v));
              return days.map(([d, v]) => (
                <div key={d} className="flex items-center gap-2 text-xs">
                  <span className="w-24 tabular-nums">{d}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded">
                    <div className="bg-brand-500 rounded h-3" style={{ width: `${(v / max) * 100}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{v}</span>
                </div>
              ));
            })()}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Accessibility — requests vs supply</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Feature</th><th className="py-1">Requests</th><th className="py-1">Desks providing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {Object.keys(ACCESSIBILITY_LABELS).map((k) => {
              const req = featureRequests.get(k) ?? 0;
              const sup = featureSupply.get(k) ?? 0;
              if (req === 0 && sup === 0) return null;
              const gap = sup === 0 && req > 0;
              return (
                <tr key={k}>
                  <td className="py-1">{ACCESSIBILITY_LABELS[k]}</td>
                  <td className="py-1">{req}</td>
                  <td className={`py-1 ${gap ? "text-red-600 font-semibold" : ""}`}>{sup}{gap && " ← no desks!"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Floor status</h2>
        <ul className="text-sm divide-y divide-slate-200 dark:divide-slate-800">
          {floors.map((f) => (
            <li key={f.id} className="py-2 flex justify-between">
              <span>Floor {f.number} — {f.name} ({f._count.desks} desks)</span>
              <span className={f.active ? "badge-green" : "badge-amber"}>{f.active ? "Open" : "Shut down"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, accent = "slate" }: { label: string; value: number | string; accent?: "slate" | "amber" | "green" }) {
  const color = accent === "amber" ? "text-amber-600" : accent === "green" ? "text-emerald-600" : "text-slate-900 dark:text-slate-100";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
