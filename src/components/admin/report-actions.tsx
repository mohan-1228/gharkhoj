"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api-client";

export function ReportActions({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function resolve(status: "resolved" | "dismissed", pauseListing: boolean) {
    setBusy(true);
    try {
      await api(`/admin/reports/${id}/resolve`, {
        method: "POST",
        json: { status, resolution: note || undefined, pauseListing },
      });
      toast.success(pauseListing ? "Listing taken down" : `Report ${status}`);
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
        aria-label="Resolution note"
        placeholder="Resolution note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button size="sm" variant="destructive" disabled={busy} onClick={() => resolve("resolved", true)}>
        Take down listing
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => resolve("resolved", false)}>
        Resolve (keep live)
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => resolve("dismissed", false)}>
        Dismiss
      </Button>
    </div>
  );
}
