"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/forms/field";
import { api, errorMessage } from "@/lib/api-client";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Window = { dayOfWeek: number; startTime: string; endTime: string };
type Exception = { date: string; note?: string | null };

/** Weekly recurring windows + one-off unavailable dates (all in Nepal time). */
export function AvailabilityEditor({
  listingId,
  initial,
}: {
  listingId: string;
  initial: { windows: Window[]; exceptions: Exception[] };
}) {
  const [windows, setWindows] = useState<Window[]>(initial.windows);
  const [exceptions, setExceptions] = useState<Exception[]>(initial.exceptions);
  const [busy, setBusy] = useState(false);

  const update = (i: number, patch: Partial<Window>) =>
    setWindows((w) => w.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Weekly hours</h2>
        <p className="text-muted-foreground text-sm">
          Renters can request 30-minute visits inside these windows. With no windows, we offer 9 AM – 6 PM every day.
        </p>
        <ul className="mt-3 space-y-2">
          {windows.map((w, i) => (
            <li key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
              <NativeSelect
                aria-label="Day"
                value={w.dayOfWeek}
                onChange={(e) => update(i, { dayOfWeek: Number(e.target.value) })}
              >
                {DAYS.map((d, n) => (
                  <option key={d} value={n}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
              <Input
                type="time"
                aria-label="From"
                step={1800}
                value={w.startTime}
                onChange={(e) => update(i, { startTime: e.target.value })}
              />
              <Input
                type="time"
                aria-label="To"
                step={1800}
                value={w.endTime}
                onChange={(e) => update(i, { endTime: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove window"
                onClick={() => setWindows((x) => x.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setWindows((w) => [...w, { dayOfWeek: 6, startTime: "10:00", endTime: "16:00" }])}
        >
          <Plus className="size-4" /> Add window
        </Button>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Unavailable dates</h2>
        <p className="text-muted-foreground text-sm">Festivals (Dashain, Tihar), travel, or days you&apos;re busy.</p>
        <ul className="mt-3 space-y-2">
          {exceptions.map((x, i) => (
            <li key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <Input
                type="date"
                aria-label="Date"
                value={x.date}
                onChange={(e) =>
                  setExceptions((ex) => ex.map((y, j) => (j === i ? { ...y, date: e.target.value } : y)))
                }
              />
              <Input
                aria-label="Note"
                placeholder="Note (optional)"
                value={x.note ?? ""}
                onChange={(e) =>
                  setExceptions((ex) => ex.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove date"
                onClick={() => setExceptions((ex) => ex.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setExceptions((x) => [...x, { date: new Date().toISOString().slice(0, 10) }])}
        >
          <Plus className="size-4" /> Add date
        </Button>
      </section>

      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/listings/${listingId}/availability`, {
              method: "PUT",
              json: {
                windows,
                exceptions: exceptions.filter((x) => x.date).map((x) => ({ date: x.date, note: x.note || undefined })),
              },
            });
            toast.success("Availability saved");
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Save availability
      </Button>
    </div>
  );
}
