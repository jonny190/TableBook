import { prisma } from "@/lib/db";
import { createBuilding, createFloor, shutdownFloor, reopenFloor } from "@/lib/admin";
import { redirect } from "next/navigation";

async function createBuildingAction(fd: FormData) {
  "use server";
  const name = String(fd.get("name") ?? "").trim();
  const address = String(fd.get("address") ?? "").trim();
  if (!name) return;
  await createBuilding(name, address || undefined);
  redirect("/dashboard/admin/floors");
}
async function createFloorAction(fd: FormData) {
  "use server";
  const buildingId = String(fd.get("buildingId") ?? "");
  const number = Number(fd.get("number"));
  const name = String(fd.get("name") ?? "").trim();
  const hvacZone = String(fd.get("hvacZone") ?? "").trim();
  if (!buildingId || Number.isNaN(number) || !name) return;
  await createFloor(buildingId, number, name, hvacZone || undefined);
  redirect("/dashboard/admin/floors");
}
async function shutdownAction(fd: FormData) {
  "use server";
  await shutdownFloor(
    String(fd.get("floorId")),
    String(fd.get("reason") ?? ""),
    Number(fd.get("kwh") || 0) || undefined,
    String(fd.get("endsAt") ?? "") || undefined,
  );
  redirect("/dashboard/admin/floors");
}
async function reopenAction(fd: FormData) {
  "use server";
  await reopenFloor(String(fd.get("floorId")));
  redirect("/dashboard/admin/floors");
}

export default async function AdminFloors() {
  const [buildings, floors] = await Promise.all([
    prisma.building.findMany({ orderBy: { name: "asc" } }),
    prisma.floor.findMany({
      include: { building: true, _count: { select: { desks: true } }, shutdowns: { orderBy: { startsAt: "desc" }, take: 1 } },
      orderBy: [{ buildingId: "asc" }, { number: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Floors &amp; shutdowns</h1>

      <div className="grid lg:grid-cols-2 gap-4">
        <form action={createBuildingAction} className="card p-4 space-y-3">
          <h2 className="font-semibold">Add a building</h2>
          <label className="block"><span className="text-sm">Name</span><input className="input mt-1" name="name" required /></label>
          <label className="block"><span className="text-sm">Address (optional)</span><input className="input mt-1" name="address" /></label>
          <button className="btn-primary" type="submit">Create building</button>
        </form>

        <form action={createFloorAction} className="card p-4 space-y-3">
          <h2 className="font-semibold">Add a floor</h2>
          <label className="block"><span className="text-sm">Building</span>
            <select className="input mt-1" name="buildingId" required>
              <option value="">Choose...</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block col-span-1"><span className="text-sm">Floor #</span><input className="input mt-1" type="number" name="number" required /></label>
            <label className="block col-span-2"><span className="text-sm">Label</span><input className="input mt-1" name="name" required placeholder="e.g. Marketing wing" /></label>
          </div>
          <label className="block"><span className="text-sm">HVAC / power zone (optional)</span><input className="input mt-1" name="hvacZone" placeholder="e.g. zone-3-north" /></label>
          <button className="btn-primary" type="submit">Create floor</button>
        </form>
      </div>

      <section className="card overflow-hidden">
        <h2 className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-semibold">Floors</h2>
        {floors.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No floors yet. Add a building and a floor above.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {floors.map((f) => {
              const open = f.active;
              const last = f.shutdowns[0];
              return (
                <li key={f.id} className="p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{f.building.name} · Floor {f.number} — {f.name}</div>
                    <div className="text-sm text-slate-500">
                      {f._count.desks} desk{f._count.desks === 1 ? "" : "s"} · HVAC zone: {f.hvacZone ?? "—"} ·{" "}
                      <span className={open ? "badge-green" : "badge-amber"}>{open ? "Open" : "Shut down"}</span>
                    </div>
                    {last && !open && (
                      <p className="text-xs text-slate-500 mt-1">
                        Last shutdown: {last.startsAt.toLocaleString()}; reason: {last.reason ?? "—"}; kWh/day saving estimate: {last.estimatedKwhPerDay ?? "—"}
                      </p>
                    )}
                  </div>
                  {open ? (
                    <form action={shutdownAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="floorId" value={f.id} />
                      <label className="block"><span className="text-xs">Reason</span><input className="input" name="reason" placeholder="Low occupancy" /></label>
                      <label className="block"><span className="text-xs">Est. kWh/day saved</span><input className="input w-32" type="number" step="0.1" name="kwh" /></label>
                      <label className="block"><span className="text-xs">Reopen by (optional)</span><input className="input" type="date" name="endsAt" /></label>
                      <button className="btn-danger" type="submit">Shut down</button>
                    </form>
                  ) : (
                    <form action={reopenAction}>
                      <input type="hidden" name="floorId" value={f.id} />
                      <button className="btn-primary" type="submit">Reopen floor</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
