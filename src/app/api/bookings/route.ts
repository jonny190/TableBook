import { NextResponse } from "next/server";
import { bookDesk } from "@/lib/booking";

export async function POST(req: Request) {
  try {
    const { deskId, date, requested } = await req.json();
    const booking = await bookDesk({ deskId, date, requested: requested ?? [] });
    return NextResponse.json({ id: booking.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return new NextResponse(msg, { status: 400 });
  }
}
