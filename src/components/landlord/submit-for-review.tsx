"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api, errorMessage } from "@/lib/api-client";

/** Prominent submit action on the edit page, with the server's readiness checklist on failure. */
export function SubmitForReview({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  return (
    <div className="border-primary/30 bg-primary/5 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Ready to go live?</p>
          <p className="text-muted-foreground text-sm">Our team reviews new listings, usually within a few hours.</p>
        </div>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setProblems([]);
            try {
              await api(`/listings/${listingId}/submit`, { method: "POST" });
              toast.success("Submitted for review — we'll email you when it's live");
              router.push("/landlord/listings");
            } catch (e) {
              if (e instanceof ApiError && e.details?.problems) setProblems(e.details.problems);
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send className="size-4" /> Submit for review
        </Button>
      </div>
      {problems.length > 0 && (
        <ul className="text-destructive mt-3 list-disc pl-5 text-sm" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
