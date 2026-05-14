import { PrismaClient, AccessibilityFeature, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Idempotent seed — safe to run multiple times.
  const adminEmail = "admin@tablebook.local";
  const userEmail = "alex@tablebook.local";
  const reporterEmail = "rachel@tablebook.local";

  const passwordHash = await bcrypt.hash("password123", 10);
  const userSpecs: Array<{ email: string; name: string; role: Role; needs: AccessibilityFeature[] }> = [
    { email: adminEmail, name: "Admin", role: "ADMIN", needs: [] },
    { email: userEmail, name: "Alex Example", role: "USER", needs: [AccessibilityFeature.WHEELCHAIR_ACCESSIBLE, AccessibilityFeature.ADJUSTABLE_HEIGHT_DESK] },
    { email: reporterEmail, name: "Rachel Reports", role: "REPORTER", needs: [] },
  ];
  for (const u of userSpecs) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, needs: u.needs },
      create: { email: u.email, name: u.name, role: u.role, needs: u.needs, passwordHash },
    });
  }

  let building = await prisma.building.findFirst({ where: { name: "HQ" } });
  if (!building) building = await prisma.building.create({ data: { name: "HQ", address: "1 Example Street" } });

  const floorSpecs = [
    { number: 1, name: "Ground floor — reception", zone: "zone-1" },
    { number: 2, name: "Engineering", zone: "zone-2" },
    { number: 3, name: "Marketing & Sales", zone: "zone-3" },
  ];
  for (const f of floorSpecs) {
    await prisma.floor.upsert({
      where: { buildingId_number: { buildingId: building.id, number: f.number } },
      update: { name: f.name, hvacZone: f.zone },
      create: { buildingId: building.id, number: f.number, name: f.name, hvacZone: f.zone },
    });
  }
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id }, orderBy: { number: "asc" } });

  // Desks per floor. Floor 1 has a couple of accessible desks placed on plan.
  const deskSpecs: { floorIdx: number; code: string; features: AccessibilityFeature[]; x?: number; y?: number; notes?: string }[] = [
    { floorIdx: 0, code: "1-A01", features: [AccessibilityFeature.WHEELCHAIR_ACCESSIBLE, AccessibilityFeature.STEP_FREE_ACCESS, AccessibilityFeature.ADJUSTABLE_HEIGHT_DESK], x: 20, y: 25, notes: "Near accessible entrance" },
    { floorIdx: 0, code: "1-A02", features: [AccessibilityFeature.STEP_FREE_ACCESS, AccessibilityFeature.NEAR_WINDOW], x: 40, y: 30 },
    { floorIdx: 0, code: "1-A03", features: [AccessibilityFeature.QUIET_ZONE, AccessibilityFeature.HEARING_LOOP], x: 60, y: 35 },
    { floorIdx: 0, code: "1-A04", features: [], x: 80, y: 40 },
    { floorIdx: 1, code: "2-B01", features: [AccessibilityFeature.STANDING_DESK, AccessibilityFeature.LARGE_MONITOR], x: 15, y: 40 },
    { floorIdx: 1, code: "2-B02", features: [AccessibilityFeature.ERGONOMIC_CHAIR], x: 30, y: 50 },
    { floorIdx: 1, code: "2-B03", features: [AccessibilityFeature.BRAILLE_LABEL, AccessibilityFeature.SCREEN_READER_READY], x: 55, y: 55 },
    { floorIdx: 1, code: "2-B04", features: [AccessibilityFeature.POWER_SOCKETS_LEFT], x: 75, y: 60 },
    { floorIdx: 1, code: "2-B05", features: [AccessibilityFeature.POWER_SOCKETS_RIGHT] },
    { floorIdx: 2, code: "3-C01", features: [AccessibilityFeature.WHEELCHAIR_ACCESSIBLE, AccessibilityFeature.ADJUSTABLE_HEIGHT_DESK] },
    { floorIdx: 2, code: "3-C02", features: [AccessibilityFeature.QUIET_ZONE] },
    { floorIdx: 2, code: "3-C03", features: [] },
  ];

  for (const spec of deskSpecs) {
    const floor = floors[spec.floorIdx];
    if (!floor) continue;
    await prisma.desk.upsert({
      where: { floorId_code: { floorId: floor.id, code: spec.code } },
      update: { features: spec.features, x: spec.x ?? null, y: spec.y ?? null, notes: spec.notes ?? null },
      create: { floorId: floor.id, code: spec.code, features: spec.features, x: spec.x ?? null, y: spec.y ?? null, notes: spec.notes ?? null },
    });
  }

  console.log("Seed complete.");
  console.log("  Admin    : admin@tablebook.local / password123");
  console.log("  User     : alex@tablebook.local / password123");
  console.log("  Reporter : rachel@tablebook.local / password123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
