import { NextResponse } from "next/server";
import { setDeskPosition } from "@/lib/floorplan";

export async function POST(req: Request) {
  try {
    const { deskId, x, y } = await req.json();
    if (typeof deskId !== "string" || typeof x !== "number" || typeof y !== "number") {
      return new NextResponse("Bad request", { status: 400 });
    }
    await setDeskPosition(deskId, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return new NextResponse(msg, { status: 400 });
  }
}
