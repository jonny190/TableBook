import { prisma } from "@/lib/db";
import { ACCESSIBILITY_LABELS } from "@/lib/utils";
import { createDesk, updateDesk, deleteDesk } from "@/lib/admin";
import type { AccessibilityFeature } from "@prisma/client";
import { redirect } from "next/navigation";

async function createAction(fd: FormData) {
  "use server";
  const floorId = String(fd.get("floorId"));
  const code = String(fd.get("code") ?? "").trim();
  const notes = String(fd.get("notes") ?? "").trim();
  const features = fd.getAll("features").map((v) => String(v)) as AccessibilityFeature[];
  if (!floorId || !code) return;
  await createDesk({ floorId, code, notes: notes || undefined, features });
  redirect("/dashboard/admin/desks?floor=" + floorId);
}

async function toggleBookable(fd: FormData) {
  "use server";
  const id = String(fd.get("id"));
  const bookable = fd.get("bookable") === "true";
  await updateDesk(id, { bookable: !bookable });
  redirect("/dashboard/admin/desks?floor=" + String(fd.get("floor") || ""));
}

async function deleteAction(fd: FormData) {
  "use server";
  await deleteDesk(String(fd.get("id")));
  redirect("/dashboard/admin/desks?floor=" + String(fd.get("floor") || ""));
}

async function updateFeaturesAction(fd: FormData) {
  "use server";
  const id = String(fd.get("id"));
  const features = fd.getAll("features").map((v) => String(v)) as AccessibilityFeature[];
  await updateDesk(id, { features });
  redirect("/dashboard/admin/desks?floor=" + String(fd.get("floor") || ""));
}

export default async function AdminDesks({ searchParams }: { searchParams: Promise<{ floor?: string }> }) {
  const sp = await searchParams;
  const floorId = sp.floor;
  const floors = await prisma.floor.findMany({
    include: { building: true },
    orderBy: [{ buildingId: "asc" }, { number: "asc" }],
  });
  const desks = floorId
    ? await prisma.desk.findMany({ where: { floorId }, orderBy: { code: "asc" } })
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Desks</h1>
      <form className="card p-4 flex gap-3 items-end flex-wrap" method="get">
        <label className="block">
          <span className="text-sm">Floor</span>
          <select className="input mt-1" name="floor" defaultValue={floorId ?? ""}>
            <option value="">Choose a floor</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>{f.building.name} · Floor {f.number} — {f.name}</option>
            ))}
          </select>
        </label>
        <button className="btn-primary" type="submit">Show</button>
      </form>

      {floorId && (
        <>
          <form action={createAction} className="card p-4 space-y-3">
            <h2 className="font-semibold">Add a desk</h2>
            <input type="hidden" name="floorId" value={floorId} />
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block"><span className="text-sm">Code (e.g. 3-A12)</span><input className="input mt-1" name="code" required /></label>
              <label className="block"><span className="text-sm">Notes (optional)</span><input className="input mt-1" name="notes" /></label>
            </div>
            <fieldset className="border border-slate-200 dark:border-slate-700 rounded-md p-3">
              <legend className="text-sm font-medium px-1">Accessibility features</legend>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(ACCESSIBILITY_LABELS).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="features" value={k} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="btn-primary" type="submit">Create desk</button>
          </form>

          <div className="card overflow-hidden">
            <h2 className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-semibold">
              Desks on this floor ({desks.length})
            </h2>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {desks.map((d) => (
                <li key={d.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-medium">Desk {d.code} {d.notes ? `— ${d.notes}` : ""}</div>
                    <div className="flex gap-2">
                      <form action={toggleBookable}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="floor" value={floorId} />
                        <input type="hidden" name="bookable" value={String(d.bookable)} />
                        <button className="btn-secondary" type="submit">{d.bookable ? "Disable" : "Enable"}</button>
                      </form>
                      <form action={deleteAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="floor" value={floorId} />
                        <button className="btn-danger" type="submit">Delete</button>
                      </form>
                    </div>
                  </div>
                  <form action={updateFeaturesAction} className="space-y-2">
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="floor" value={floorId} />
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-1 text-sm">
                      {Object.entries(ACCESSIBILITY_LABELS).map(([k, label]) => (
                        <label key={k} className="flex items-center gap-2">
                          <input type="checkbox" name="features" value={k} defaultChecked={d.features.includes(k as AccessibilityFeature)} />
                          {label}
                        </label>
                      ))}
                    </div>
                    <button className="btn-secondary" type="submit">Save features</button>
                  </form>
                </li>
              ))}
              {desks.length === 0 && <li className="p-4 text-sm text-slate-500">No desks yet.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
