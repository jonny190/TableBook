"use server";

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { requireRole } from "./auth";
import { revalidatePath } from "next/cache";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "floorplans");

export async function uploadFloorPlan(floorId: string, file: File) {
  const session = await requireRole("ADMIN");
  if (!file || file.size === 0) throw new Error("No file");
  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
    throw new Error("Unsupported file type");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("File too large (max 8MB)");

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
  const filename = `${floorId}.${ext}`;
  const fullPath = path.join(UPLOAD_DIR, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);
  const webPath = `/uploads/floorplans/${filename}`;

  await prisma.floorPlan.upsert({
    where: { floorId },
    update: { imagePath: webPath, mimeType: file.type, uploadedById: session.user.id, uploadedAt: new Date() },
    create: { floorId, imagePath: webPath, mimeType: file.type, uploadedById: session.user.id },
  });
  revalidatePath("/dashboard/floor-plan");
  revalidatePath("/dashboard/admin/floors");
}

export async function setDeskPosition(deskId: string, x: number, y: number) {
  await requireRole("ADMIN");
  await prisma.desk.update({ where: { id: deskId }, data: { x, y } });
  revalidatePath("/dashboard/floor-plan");
}
