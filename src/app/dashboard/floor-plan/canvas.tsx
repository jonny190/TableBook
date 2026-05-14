"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ACCESSIBILITY_LABELS } from "@/lib/utils";

type DeskMarker = {
  id: string;
  code: string;
  x: number | null;
  y: number | null;
  bookable: boolean;
  features: string[];
  bookedByMe: boolean;
  bookedCount: number;
};

export function FloorPlanCanvas({
  floorId,
  imagePath,
  desks,
  dateIso,
  isAdmin,
  userNeeds,
}: {
  floorId: string;
  imagePath: string;
  desks: DeskMarker[];
  dateIso: string;
  isAdmin: boolean;
  userNeeds: string[];
}) {
  const [mode, setMode] = useState<"view" | "place">("view");
  const [selectedDesk, setSelectedDesk] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const placedDesks = desks.filter((d) => d.x != null && d.y != null);
  const unplacedDesks = desks.filter((d) => d.x == null || d.y == null);

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "place" || !selectedDesk || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    start(async () => {
      const res = await fetch("/api/desks/position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskId: selectedDesk, x, y }),
      });
      if (!res.ok) {
        setError((await res.text()) || "Failed to place desk");
      } else {
        setSelectedDesk(null);
        router.refresh();
      }
    });
  }

  async function book(deskId: string) {
    setError(null);
    start(async () => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskId, date: dateIso }),
      });
      if (!res.ok) {
        setError((await res.text()) || "Booking failed");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="card p-3 flex flex-wrap gap-2 items-center text-sm">
          <button
            type="button"
            className={mode === "place" ? "btn-primary" : "btn-secondary"}
            onClick={() => setMode(mode === "place" ? "view" : "place")}
          >
            {mode === "place" ? "Done placing" : "Place desks on plan"}
          </button>
          {mode === "place" && (
            <>
              <span>Select a desk, then click on the plan:</span>
              <select className="input" value={selectedDesk ?? ""} onChange={(e) => setSelectedDesk(e.target.value || null)}>
                <option value="">— pick desk —</option>
                {desks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} {d.x != null ? "✓ placed" : ""}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">{unplacedDesks.length} unplaced</span>
            </>
          )}
        </div>
      )}

      {error && <div className="card p-3 bg-red-50 dark:bg-red-950/40 text-red-700 text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <div
          ref={imgRef}
          onClick={handleCanvasClick}
          className={`relative w-full ${mode === "place" ? "cursor-crosshair" : ""}`}
          style={{ paddingTop: "62.5%" /* keeps the canvas area visible before image loads */ }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePath} alt="Floor plan" className="absolute inset-0 w-full h-full object-contain bg-slate-50 dark:bg-slate-900" />
          {placedDesks.map((d) => {
            const booked = d.bookedCount > 0;
            const matchesNeeds = userNeeds.length > 0 && userNeeds.every((n) => d.features.includes(n));
            const fill = !d.bookable
              ? "bg-slate-400"
              : d.bookedByMe
              ? "bg-brand-600 ring-2 ring-brand-300"
              : booked
              ? "bg-red-500"
              : matchesNeeds
              ? "bg-emerald-500 ring-2 ring-emerald-300"
              : "bg-emerald-500";
            return (
              <button
                key={d.id}
                title={`Desk ${d.code}${d.features.length ? " — " + d.features.map((f) => ACCESSIBILITY_LABELS[f] ?? f).join(", ") : ""}${booked ? " · booked" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (mode === "view" && !booked && d.bookable) book(d.id);
                }}
                disabled={pending || (mode === "view" && (booked || !d.bookable))}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow ${fill} ${
                  mode === "view" && !booked && d.bookable ? "hover:scale-110" : ""
                }`}
                style={{ left: `${d.x}%`, top: `${d.y}%` }}
              >
                {d.code.slice(-3)}
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 text-xs flex flex-wrap gap-3 items-center bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Available</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Booked</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-brand-600 inline-block" /> Your booking</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-400 inline-block" /> Disabled</span>
          <span className="ml-auto text-slate-500">Booking for {dateIso}. <Link className="text-brand-600 hover:underline" href="/dashboard/book">List view</Link></span>
        </div>
      </div>

      {unplacedDesks.length > 0 && (
        <div className="card p-3 text-sm">
          <div className="font-medium mb-1">Desks not yet placed on plan:</div>
          <div className="flex flex-wrap gap-2">
            {unplacedDesks.map((d) => <span key={d.id} className="badge-slate">{d.code}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
