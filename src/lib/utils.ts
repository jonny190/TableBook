import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isoDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function startOfDay(d: Date | string): Date {
  const date = typeof d === "string" ? new Date(d) : new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export const ACCESSIBILITY_LABELS: Record<string, string> = {
  WHEELCHAIR_ACCESSIBLE: "Wheelchair accessible",
  STEP_FREE_ACCESS: "Step-free access",
  ADJUSTABLE_HEIGHT_DESK: "Adjustable-height desk",
  LARGE_MONITOR: "Large monitor",
  BRAILLE_LABEL: "Braille label",
  SCREEN_READER_READY: "Screen-reader ready",
  HEARING_LOOP: "Hearing loop",
  QUIET_ZONE: "Quiet zone",
  ERGONOMIC_CHAIR: "Ergonomic chair",
  NEAR_WINDOW: "Near window",
  STANDING_DESK: "Standing desk",
  POWER_SOCKETS_LEFT: "Power sockets (left)",
  POWER_SOCKETS_RIGHT: "Power sockets (right)",
};

export const ACCESSIBILITY_KEYS = Object.keys(ACCESSIBILITY_LABELS);
