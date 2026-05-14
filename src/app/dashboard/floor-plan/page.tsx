import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isoDate, startOfDay } from "@/lib/utils";
import { uploadFloorPlan } from "@/lib/floorplan";
import { FloorPlanCanvas } from "./canvas";
import { redirect } from "next/navigation";

async function uploadAction(fd: FormData) {
  "use server";
  const floorId = String(fd.get("floorId"));
  const file = fd.get("file") as File | null;
  if (!floorId || !file) return;
  await uploadFloorPlan(floorId, file);
  redirect(`/dashboard/floor-plan?floor=${floorId}`);
}

export default async function FloorPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ floor?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session) return null;

  const floors = await prisma.floor.findMany({
    include: { building: true, floorPlan: true },
    orderBy: [{ buildingId: "asc" }, { number: "asc" }],
  });
  const floorId = sp.floor || floors[0]?.id;
  const floor = floorId ? floors.find((f) => f.id === floorId) ?? null : null;
  const date = startOfDay(sp.date ?? new Date());

  const desks = floorId
    ? await prisma.desk.findMany({
        where: { floorId },
        include: {
          bookings: { where: { date, status: { not: "CANCELLED" } }, select: { id: true, userId: true } },
        },
        orderBy: { code: "asc" },
      })
    : [];

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Floor plan</h1>
      </div>

      <form className="card p-3 flex flex-wrap gap-3 items-end" method="get">
        <label className="block">
          <span className="text-sm">Floor</span>
          <select className="input mt-1" name="floor" defaultValue={floorId ?? ""}>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>{f.building.name} · Floor {f.number} — {f.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm">Date</span>
          <input className="input mt-1" type="date" name="date" defaultValue={isoDate(date)} min={isoDate(new Date())} />
        </label>
        <button className="btn-primary" type="submit">Show</button>
      </form>

      {floor && !floor.floorPlan && (
        <div className="card p-4 text-sm">
          <p className="mb-2">No floor plan uploaded for this floor yet.</p>
          {isAdmin ? (
            <form action={uploadAction} encType="multipart/form-data" className="flex flex-wrap gap-2 items-end">
              <input type="hidden" name="floorId" value={floor.id} />
              <input className="input" type="file" name="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required />
              <button className="btn-primary" type="submit">Upload plan</button>
            </form>
          ) : (
            <p className="text-slate-500">Ask an admin to upload one.</p>
          )}
        </div>
      )}

      {floor?.floorPlan && (
        <FloorPlanCanvas
          floorId={floor.id}
          imagePath={floor.floorPlan.imagePath}
          desks={desks.map((d) => ({
            id: d.id,
            code: d.code,
            x: d.x,
            y: d.y,
            bookable: d.bookable,
            features: d.features,
            bookedByMe: d.bookings.some((b) => b.userId === session.user.id),
            bookedCount: d.bookings.length,
          }))}
          dateIso={isoDate(date)}
          isAdmin={isAdmin}
          userNeeds={me?.needs ?? []}
        />
      )}

      {isAdmin && floor?.floorPlan && (
        <form action={uploadAction} encType="multipart/form-data" className="card p-3 flex flex-wrap gap-2 items-end text-sm">
          <input type="hidden" name="floorId" value={floor.id} />
          <span>Replace plan:</span>
          <input className="input" type="file" name="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required />
          <button className="btn-secondary" type="submit">Replace</button>
        </form>
      )}
    </div>
  );
}
