"use server";

import { prisma } from "./db";
import { auth } from "./auth";
import { startOfDay } from "./utils";
import { revalidatePath } from "next/cache";
import type { AccessibilityFeature } from "@prisma/client";

export async function bookDesk(input: { deskId: string; date: string; requested: AccessibilityFeature[] }) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  const date = startOfDay(input.date);

  const desk = await prisma.desk.findUnique({
    where: { id: input.deskId },
    include: { floor: { include: { building: true } } },
  });
  if (!desk || !desk.bookable) throw new Error("Desk not bookable");
  if (!desk.floor.active) throw new Error("Floor is shut down for that day");

  // Reject if booking falls in active shutdown window
  const overlapping = await prisma.floorShutdown.findFirst({
    where: {
      floorId: desk.floorId,
      startsAt: { lte: date },
      OR: [{ endsAt: null }, { endsAt: { gte: date } }],
    },
  });
  if (overlapping) throw new Error("Floor is shut down on that date");

  try {
    const booking = await prisma.booking.create({
      data: {
        userId: session.user.id,
        deskId: desk.id,
        date,
        requestedFeatures: input.requested,
      },
    });
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: "BOOKING_CONFIRMED",
        title: "Booking confirmed",
        body: `Desk ${desk.code} on Floor ${desk.floor.number} (${desk.floor.building.name}) for ${date.toDateString()}.`,
        link: "/dashboard/my-bookings",
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/book");
    revalidatePath("/dashboard/my-bookings");
    return booking;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      throw new Error("That desk is already booked for the chosen date.");
    }
    throw e;
  }
}

export async function cancelBooking(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  const booking = await prisma.booking.findUnique({ where: { id }, include: { desk: { include: { floor: true } } } });
  if (!booking) throw new Error("Not found");
  if (booking.userId !== session.user.id && session.user.role !== "ADMIN") throw new Error("FORBIDDEN");
  if (booking.status === "CANCELLED") return booking;
  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  await prisma.notification.create({
    data: {
      userId: booking.userId,
      type: "BOOKING_CANCELLED",
      title: "Booking cancelled",
      body: `Desk ${booking.desk.code} on ${booking.date.toDateString()} was cancelled.`,
      link: "/dashboard/my-bookings",
    },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/book");
  revalidatePath("/dashboard/my-bookings");
  return updated;
}
