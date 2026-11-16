"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api-client";

const QUICK_REASONS = [
  "Photos are unclear or not of the property",
  "Description contains phone numbers or payment instructions",
  "Price or details look inaccurate",
  "Duplicate of an existing listing",
];

export function ReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(path: string, body: unknown, msg: string) {
    setBusy(true);
    try {
      await api(path, { method: "POST", json: body });
      toast.success(msg);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-2">
        <Button
          disabled={busy}
          onClick={() => run(`/admin/listings/${id}/approve`, {}, "Approved — landlord notified")}
        >
          Approve & publish
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => setRejecting((r) => !r)}>
          Reject…
        </Button>
      </div>
      {rejecting && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap gap-1">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className="hover:bg-muted rounded-full border px-2 py-0.5 text-xs"
                onClick={() => setReason(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea
            rows={2}
            aria-label="Rejection reason (sent to the landlord)"
            placeholder="Reason (sent to the landlord)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="destructive"
            size="sm"
            disabled={busy || reason.trim().length < 5}
            onClick={() => run(`/admin/listings/${id}/reject`, { reason }, "Rejected — landlord notified")}
          >
            Reject listing
          </Button>
        </div>
      )}
    </div>
  );
}
