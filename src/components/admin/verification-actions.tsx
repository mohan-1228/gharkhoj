"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api-client";

export function VerificationActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function decide(decision: "verified" | "rejected") {
    setBusy(true);
    try {
      await api(`/admin/verifications/${userId}`, { method: "POST", json: { decision, note: note || undefined } });
      toast.success(decision === "verified" ? "Landlord verified" : "Verification rejected");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Input
        className="max-w-xs"
        aria-label="Note to landlord"
        placeholder="Note (required if rejecting)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button size="sm" disabled={busy} onClick={() => decide("verified")}>
        Verify
      </Button>
      <Button size="sm" variant="outline" disabled={busy || note.trim().length < 3} onClick={() => decide("rejected")}>
        Reject
      </Button>
    </div>
  );
}
