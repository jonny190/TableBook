import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ACCESSIBILITY_LABELS, isoDate, startOfDay } from "@/lib/utils";
import { bookDesk } from "@/lib/booking";
import type { AccessibilityFeature } from "@prisma/client";
import { redirect } from "next/navigation";

const ALL_FEATURES = Object.keys(ACCESSIBILITY_LABELS) as AccessibilityFeature[];

async function bookAction(formData: FormData) {
  "use server";
  const deskId = String(formData.get("deskId") ?? "");
  const date = String(formData.get("date") ?? "");
  const requested = formData.getAll("requested").map((v) => String(v)) as AccessibilityFeature[];
  try {
    await bookDesk({ deskId, date, requested });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Booking failed";
    redirect(`/dashboard/book?date=${date}&error=${encodeURIComponent(msg)}`);
  }
  redirect(`/dashboard/book?date=${date}&ok=1`);
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; features?: string; building?: string; floor?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session) return null;

  const date = startOfDay(sp.date ?? new Date());
  const dateStr = isoDate(date);
  const selectedFeatures = (sp.features ?? "").split(",").filter(Boolean) as AccessibilityFeature[];
  const buildingId = sp.building || undefined;
  const floorId = sp.floor || undefined;

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });

  const [buildings, allFloors, desks, shutdowns] = await Promise.all([
    prisma.building.findMany({ orderBy: { name: "asc" } }),
    prisma.floor.findMany({
      where: { active: true, ...(buildingId ? { buildingId } : {}) },
      orderBy: [{ buildingId: "asc" }, { number: "asc" }],
      include: { building: true },
    }),
    prisma.desk.findMany({
      where: {
        bookable: true,
        floor: {
          active: true,
          ...(buildingId ? { buildingId } : {}),
          ...(floorId ? { id: floorId } : {}),
          shutdowns: {
            none: {
              startsAt: { lte: date },
              OR: [{ endsAt: null }, { endsAt: { gte: date } }],
            },
          },
        },
        ...(selectedFeatures.length > 0 ? { features: { hasEvery: selectedFeatures } } : {}),
      },
      include: {
        floor: { include: { building: true } },
        bookings: { where: { date, status: { not: "CANCELLED" } }, select: { id: true } },
      },
      orderBy: [{ floorId: "asc" }, { code: "asc" }],
      take: 200,
    }),
    prisma.floorShutdown.findMany({
      where: { startsAt: { lte: date }, OR: [{ endsAt: null }, { endsAt: { gte: date } }] },
      include: { floor: { include: { building: true } } },
    }),
  ]);

  const available = desks.filter((d) => d.bookings.length === 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Book a desk</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Pick a date and filter by accessibility needs.</p>
        </div>
        <Link href="/dashboard/floor-plan" className="btn-secondary">View floor plan</Link>
      </div>

      {sp.ok && <div className="card p-3 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-sm">Booking confirmed.</div>}
      {sp.error && <div className="card p-3 bg-red-50 dark:bg-red-950/40 border-red-200 text-sm text-red-700 dark:text-red-300">{sp.error}</div>}

      <form className="card p-4 grid lg:grid-cols-4 gap-3 items-end" method="get">
        <label className="block">
          <span className="text-sm font-medium">Date</span>
          <input className="input mt-1" type="date" name="date" defaultValue={dateStr} min={isoDate(new Date())} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Building</span>
          <select className="input mt-1" name="building" defaultValue={buildingId ?? ""}>
            <option value="">Any</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Floor</span>
          <select className="input mt-1" name="floor" defaultValue={floorId ?? ""}>
            <option value="">Any</option>
            {allFloors.map((f) => (
              <option key={f.id} value={f.id}>{f.building.name} · Floor {f.number} — {f.name}</option>
            ))}
          </select>
        </label>
        <button className="btn-primary" type="submit">Apply</button>

        <fieldset className="lg:col-span-4 border border-slate-200 dark:border-slate-700 rounded-md p-3">
          <legend className="text-sm font-medium px-1">Required accessibility features</legend>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {ALL_FEATURES.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="features"
                  value={k}
                  defaultChecked={selectedFeatures.includes(k)}
                  className="rounded border-slate-300"
                />
                {ACCESSIBILITY_LABELS[k]}
                {me?.needs.includes(k) && <span className="text-xs text-brand-600">(your need)</span>}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Selecting features narrows the list to desks that have <strong>all</strong> of them.
          </p>
        </fieldset>
        {/* preserve features as a single CSV through page-level query, but checkboxes above are the source */}
      </form>

      {shutdowns.length > 0 && (
        <div className="card p-3 border-amber-200 bg-amber-50 dark:bg-amber-950/40 text-sm">
          <strong>Floors shut down for {dateStr}:</strong>{" "}
          {shutdowns.map((s) => `${s.floor.building.name} · Floor ${s.floor.number}`).join("; ")}.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between text-sm">
          <span>{available.length} desk{available.length === 1 ? "" : "s"} available</span>
          <span className="text-slate-500">{desks.length - available.length} booked</span>
        </div>
        {available.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No desks match your filters for {dateStr}.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {available.map((d) => (
              <li key={d.id} className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="font-medium">
                    Desk {d.code} · {d.floor.building.name} · Floor {d.floor.number} ({d.floor.name})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {d.features.length === 0 && <span className="badge-slate">Standard desk</span>}
                    {d.features.map((f) => {
                      const matches = selectedFeatures.includes(f);
                      const needed = me?.needs.includes(f);
                      return (
                        <span key={f} className={matches || needed ? "badge-green" : "badge-slate"}>
                          {ACCESSIBILITY_LABELS[f]}
                        </span>
                      );
                    })}
                  </div>
                  {d.notes && <p className="text-xs text-slate-500">{d.notes}</p>}
                </div>
                <form action={bookAction} className="flex items-center gap-2">
                  <input type="hidden" name="deskId" value={d.id} />
                  <input type="hidden" name="date" value={dateStr} />
                  {selectedFeatures.map((f) => <input key={f} type="hidden" name="requested" value={f} />)}
                  <button className="btn-primary" type="submit">Book</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
