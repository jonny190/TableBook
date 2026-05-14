"use server";

import { prisma } from "./db";
import { requireRole } from "./auth";
import { revalidatePath } from "next/cache";
import { startOfDay } from "./utils";
import type { AccessibilityFeature } from "@prisma/client";

export async function createBuilding(name: string, address?: string) {
  await requireRole("ADMIN");
  const b = await prisma.building.create({ data: { name, address: address || null } });
  revalidatePath("/dashboard/admin/floors");
  return b;
}

export async function createFloor(buildingId: string, number: number, name: string, hvacZone?: string) {
  await requireRole("ADMIN");
  const f = await prisma.floor.create({ data: { buildingId, number, name, hvacZone: hvacZone || null } });
  revalidatePath("/dashboard/admin/floors");
  return f;
}

export async function shutdownFloor(floorId: string, reason: string, estimatedKwhPerDay?: number, endsAt?: string) {
  const session = await requireRole("ADMIN");
  const floor = await prisma.floor.update({ where: { id: floorId }, data: { active: false } });
  const shutdown = await prisma.floorShutdown.create({
    data: {
      floorId,
      reason: reason || null,
      estimatedKwhPerDay: estimatedKwhPerDay && !Number.isNaN(estimatedKwhPerDay) ? estimatedKwhPerDay : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      startsAt: new Date(),
      createdById: session.user.id,
    },
  });

  // Notify everyone who has a CONFIRMED booking on this floor in the window
  const today = startOfDay(new Date());
  const cutoff = endsAt ? new Date(endsAt) : null;
  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      date: { gte: today, ...(cutoff ? { lte: cutoff } : {}) },
      desk: { floorId },
    },
    include: { desk: true, user: true },
  });
  for (const b of bookings) {
    await prisma.notification.create({
      data: {
        userId: b.userId,
        type: "FLOOR_CLOSED",
        title: `Floor ${floor.number} closed`,
        body: `Your booking on ${b.date.toDateString()} (desk ${b.desk.code}) may be affected — Floor ${floor.number} has been shut down. Reason: ${reason || "—"}`,
        link: "/dashboard/my-bookings",
      },
    });
  }
  revalidatePath("/dashboard/admin/floors");
  revalidatePath("/dashboard/book");
  return shutdown;
}

export async function reopenFloor(floorId: string) {
  await requireRole("ADMIN");
  await prisma.floor.update({ where: { id: floorId }, data: { active: true } });
  await prisma.floorShutdown.updateMany({ where: { floorId, endsAt: null }, data: { endsAt: new Date() } });
  const floor = await prisma.floor.findUnique({ where: { id: floorId } });
  // notify users who had bookings on this floor in the next 14 days
  const upcoming = await prisma.booking.findMany({
    where: { status: "CONFIRMED", desk: { floorId }, date: { gte: startOfDay(new Date()) } },
    distinct: ["userId"],
    select: { userId: true },
  });
  for (const u of upcoming) {
    await prisma.notification.create({
      data: {
        userId: u.userId,
        type: "FLOOR_REOPENED",
        title: `Floor ${floor?.number ?? ""} reopened`,
        body: "The floor is open again — your bookings remain valid.",
        link: "/dashboard/my-bookings",
      },
    });
  }
  revalidatePath("/dashboard/admin/floors");
  revalidatePath("/dashboard/book");
}

export async function createDesk(input: {
  floorId: string;
  code: string;
  features: AccessibilityFeature[];
  notes?: string;
  x?: number;
  y?: number;
}) {
  await requireRole("ADMIN");
  const d = await prisma.desk.create({
    data: {
      floorId: input.floorId,
      code: input.code,
      features: input.features,
      notes: input.notes ?? null,
      x: input.x ?? null,
      y: input.y ?? null,
    },
  });
  revalidatePath("/dashboard/admin/desks");
  revalidatePath("/dashboard/floor-plan");
  return d;
}

export async function updateDesk(id: string, input: {
  code?: string;
  features?: AccessibilityFeature[];
  notes?: string | null;
  x?: number | null;
  y?: number | null;
  bookable?: boolean;
}) {
  await requireRole("ADMIN");
  const d = await prisma.desk.update({ where: { id }, data: input });
  revalidatePath("/dashboard/admin/desks");
  revalidatePath("/dashboard/floor-plan");
  return d;
}

export async function deleteDesk(id: string) {
  await requireRole("ADMIN");
  await prisma.desk.delete({ where: { id } });
  revalidatePath("/dashboard/admin/desks");
  revalidatePath("/dashboard/floor-plan");
}

export async function updateUser(id: string, input: { role?: "USER" | "ADMIN" | "REPORTER"; active?: boolean }) {
  await requireRole("ADMIN");
  const u = await prisma.user.update({ where: { id }, data: input });
  revalidatePath("/dashboard/admin/users");
  return u;
}

export async function sendAdminMessage(userIds: string[], title: string, body: string) {
  await requireRole("ADMIN");
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: "ADMIN_MESSAGE" as const,
      title,
      body,
    })),
  });
  revalidatePath("/dashboard/admin/users");
}
