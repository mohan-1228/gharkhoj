"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api-client";
import { formatKathmandu } from "@/lib/format";
import { ktmToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { TourDto } from "@/server/services/tour-service";

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-900",
  rescheduled: "bg-sky-100 text-sky-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  declined: "bg-red-100 text-red-900",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-slate-200 text-slate-800",
  no_show: "bg-slate-200 text-slate-800",
};
const STATUS_LABEL: Record<string, string> = {
  requested: "Awaiting landlord",
  rescheduled: "New time proposed",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
};

export function TourCard({ tour, viewer }: { tour: TourDto; viewer: "renter" | "landlord" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<null | "decline" | "reschedule">(null);
  const [note, setNote] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("10:00");

  async function act(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      await api(`/tours/${tour.id}`, { method: "PATCH", json: body });
      toast.success(success);
      setMode(null);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const past = tour.confirmedSlot ? new Date(tour.confirmedSlot).getTime() < Date.now() : false;

  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/listing/${tour.listing.slug}`} className="font-medium hover:underline">
            {tour.listing.title}
          </Link>
          <p className="text-muted-foreground text-sm">{tour.listing.place}</p>
        </div>
        <Badge variant="secondary" className={cn(STATUS_STYLE[tour.status])}>
          {viewer === "landlord" && tour.status === "requested"
            ? "Needs your response"
            : viewer === "landlord" && tour.status === "rescheduled"
              ? "Waiting for renter"
              : (STATUS_LABEL[tour.status] ?? tour.status)}
        </Badge>
      </div>

      {tour.confirmedSlot && ["confirmed", "rescheduled", "completed"].includes(tour.status) ? (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">{tour.status === "rescheduled" ? "Proposed: " : "When: "}</span>
          <strong>{formatKathmandu(tour.confirmedSlot)}</strong>
        </p>
      ) : (
        <div className="mt-3 text-sm">
          <p className="text-muted-foreground">Requested times (Nepal time):</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {tour.requestedSlots.map((s) => (
              <li key={s} className="bg-muted flex items-center gap-2 rounded-md px-2 py-1">
                {formatKathmandu(s)}
                {viewer === "landlord" && tour.status === "requested" && (
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={busy}
                    onClick={() =>
                      act({ action: "confirm", slot: s }, "Tour confirmed — both of you will get an email")
                    }
                  >
                    Confirm
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tour.renterMessage && <p className="mt-2 text-sm italic">“{tour.renterMessage}”</p>}
      {tour.landlordNote && <p className="mt-2 text-sm">Landlord note: {tour.landlordNote}</p>}

      {viewer === "landlord" && tour.renter && (
        <p className="mt-2 flex items-center gap-2 text-sm">
          <Phone className="size-4" aria-hidden /> {tour.renter.name} ·{" "}
          <a className="text-primary underline" href={`tel:${tour.renter.phone}`}>
            {tour.renter.phone}
          </a>
        </p>
      )}
      {viewer === "renter" && tour.landlord && (
        <p className="mt-2 text-sm">
          Landlord: {tour.landlord.name}
          {tour.landlord.phone ? (
            <>
              {" "}
              ·{" "}
              <a className="text-primary underline" href={`tel:${tour.landlord.phone}`}>
                {tour.landlord.phone}
              </a>
            </>
          ) : (
            <span className="text-muted-foreground"> · phone shown after confirmation</span>
          )}
        </p>
      )}
      {tour.address && <p className="mt-1 text-sm">Address: {tour.address}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {tour.status === "confirmed" && (
          <Button asChild variant="outline" size="sm">
            <a href={`/api/v1/tours/${tour.id}/ics`}>
              <CalendarPlus className="size-4" /> Add to calendar
            </a>
          </Button>
        )}
        {viewer === "renter" && tour.status === "rescheduled" && tour.confirmedSlot && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => act({ action: "confirm", slot: tour.confirmedSlot }, "New time accepted")}
          >
            Accept new time
          </Button>
        )}
        {viewer === "landlord" && ["requested", "confirmed"].includes(tour.status) && (
          <Button variant="outline" size="sm" onClick={() => setMode(mode === "reschedule" ? null : "reschedule")}>
            Propose another time
          </Button>
        )}
        {viewer === "landlord" && ["requested", "rescheduled"].includes(tour.status) && (
          <Button variant="outline" size="sm" onClick={() => setMode(mode === "decline" ? null : "decline")}>
            Decline
          </Button>
        )}
        {viewer === "landlord" && tour.status === "confirmed" && past && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => act({ action: "complete" }, "Marked as completed")}
            >
              Mark completed
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => act({ action: "no_show" }, "Marked as no-show")}
            >
              No-show
            </Button>
          </>
        )}
        {(viewer === "renter" ? ["requested", "confirmed", "rescheduled"] : ["confirmed"]).includes(tour.status) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={busy}
            onClick={() => act({ action: "cancel" }, "Tour cancelled")}
          >
            Cancel tour
          </Button>
        )}
      </div>

      {mode === "reschedule" && (
        <div className="mt-3 grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto]">
          <Input
            type="date"
            aria-label="New date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
          />
          <Input
            type="time"
            aria-label="New time (Nepal time)"
            value={newTime}
            step={1800}
            onChange={(e) => setNewTime(e.target.value)}
          />
          <Button
            size="sm"
            disabled={busy || !newDate}
            onClick={() =>
              act(
                { action: "reschedule", slot: ktmToUtc(newDate, newTime).toISOString(), note: note || undefined },
                "New time proposed to the renter",
              )
            }
          >
            Send proposal
          </Button>
          <Textarea
            className="sm:col-span-3"
            rows={2}
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
      {mode === "decline" && (
        <div className="mt-3 space-y-2 rounded-lg border p-3">
          <Textarea
            rows={2}
            placeholder="Reason (optional, shared with the renter)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => act({ action: "decline", note: note || undefined }, "Request declined")}
          >
            Decline request
          </Button>
        </div>
      )}
    </article>
  );
}
