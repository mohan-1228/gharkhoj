"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { CalendarCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { useSession } from "@/hooks/use-session";
import { utcToKtm } from "@/lib/time";
import { cn } from "@/lib/utils";

const MAX_SLOTS = 3;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function label12(time: string) {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Renter picks up to 3 preferred times (Nepal time) and sends a tour request. */
export function TourRequestPanel({ listingId }: { listingId: string }) {
  const pathname = usePathname();
  const { data: me, isLoading: loadingMe } = useSession();
  const [day, setDay] = useState<Date | undefined>();
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // One key per form instance: double-taps and retries on flaky networks can't create duplicates.
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["slots", listingId],
    queryFn: () => api<{ days: { date: string; slots: string[] }[] }>(`/listings/${listingId}/slots`),
    enabled: !!me,
  });
  const byDate = useMemo(() => new Map((data?.days ?? []).map((d) => [d.date, d.slots])), [data]);
  const daySlots = day ? (byDate.get(ymd(day)) ?? []) : [];

  if (loadingMe) return <div className="bg-muted h-40 animate-pulse rounded-lg" />;
  if (!me) {
    return (
      <div className="space-y-2 text-center">
        <Button asChild className="w-full" size="lg">
          <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`}>Sign in to schedule a tour</Link>
        </Button>
        <p className="text-muted-foreground text-xs">Free for renters. The landlord confirms by email.</p>
      </div>
    );
  }
  if (done) {
    return (
      <div className="space-y-2 text-center">
        <CalendarCheck className="mx-auto size-8 text-emerald-600" aria-hidden />
        <p className="font-medium">Request sent!</p>
        <p className="text-muted-foreground text-sm">
          We&apos;ve emailed the landlord. You&apos;ll get an email when they respond.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/account/tours">View my tours</Link>
        </Button>
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    try {
      await api("/tours", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey.current },
        json: { listingId, slots: picked, message: message || undefined, contactPhone: phone ?? me?.phone ?? "" },
      });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === "CONFLICT") toast.info(e.message);
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">1. Pick a day</h3>
        {isLoading ? (
          <div className="bg-muted mt-2 h-64 animate-pulse rounded-lg" />
        ) : isError ? (
          <p className="text-destructive mt-2 text-sm">Couldn&apos;t load available times.</p>
        ) : byDate.size === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">No tour times available in the next two weeks.</p>
        ) : (
          <DayPicker
            mode="single"
            selected={day}
            onSelect={setDay}
            disabled={(d) => !byDate.has(ymd(d))}
            startMonth={new Date()}
            endMonth={new Date(Date.now() + 15 * 86_400_000)}
            className="mt-2 text-sm [--rdp-accent-color:var(--primary)] [--rdp-day-height:36px] [--rdp-day-width:36px] [--rdp-day_button-height:34px] [--rdp-day_button-width:34px]"
          />
        )}
      </div>

      {day && (
        <div>
          <h3 className="text-sm font-medium">2. Choose up to {MAX_SLOTS} times (Nepal time)</h3>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Available times">
            {daySlots.map((s) => {
              const on = picked.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && picked.length >= MAX_SLOTS}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s) : [...p, s]))}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm disabled:opacity-40",
                    on && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {label12(utcToKtm(new Date(s)).time)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {picked.length > 0 && (
        <ul className="space-y-1 text-sm" aria-label="Selected times">
          {[...picked].sort().map((s) => {
            const k = utcToKtm(new Date(s));
            return (
              <li key={s} className="bg-muted flex items-center justify-between rounded-md px-2 py-1">
                {new Date(`${k.date}T00:00:00Z`).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })}{" "}
                · {label12(k.time)}
                <button
                  type="button"
                  aria-label="Remove time"
                  onClick={() => setPicked((p) => p.filter((x) => x !== s))}
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2">
        <label htmlFor="tour-phone" className="text-sm font-medium">
          Your mobile number
        </label>
        <Input
          id="tour-phone"
          type="tel"
          inputMode="tel"
          placeholder="98XXXXXXXX"
          value={phone ?? me.phone ?? ""}
          onChange={(e) => setPhone(e.target.value)}
        />
        <label htmlFor="tour-msg" className="sr-only">
          Message to the landlord
        </label>
        <Textarea
          id="tour-msg"
          rows={3}
          placeholder="Message (optional) — e.g. who will be living there, move-in date"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
        />
      </div>
      <Button
        className="w-full"
        size="lg"
        disabled={busy || picked.length === 0 || !(phone ?? me.phone)}
        onClick={submit}
      >
        {busy
          ? "Sending…"
          : picked.length
            ? `Request tour (${picked.length} time${picked.length > 1 ? "s" : ""})`
            : "Request tour"}
      </Button>
      <p className="text-muted-foreground text-xs">Your number is shared only with this landlord.</p>
    </div>
  );
}
