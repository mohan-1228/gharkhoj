"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/constants";

export function ReportButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("scam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <Flag className="size-4" /> Report listing
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this listing</DialogTitle>
            <DialogDescription>
              Our team reviews every report. Asked to pay a deposit before visiting? That&apos;s a common scam — please
              report it.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="sr-only">Reason</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-[var(--primary)]"
                />
                {REPORT_REASON_LABELS[r]}
              </label>
            ))}
          </fieldset>
          <Textarea
            rows={3}
            aria-label="Details"
            placeholder="Details (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={2000}
          />
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/reports", { method: "POST", json: { listingId, reason, details: details || undefined } });
                  toast.success("Thanks — we'll review this listing");
                  setOpen(false);
                } catch (e) {
                  if (e instanceof ApiError && e.code === "CONFLICT") {
                    toast.info(e.message);
                    setOpen(false);
                  } else toast.error(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
