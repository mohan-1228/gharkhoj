"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api-client";
import type { ListingStatusValue } from "@/lib/constants";

const ACTIONS: Record<string, { label: string; from: ListingStatusValue[] }> = {
  submit: { label: "Submit for review", from: ["draft", "rejected"] },
  pause: { label: "Pause listing", from: ["published"] },
  resume: { label: "Resume listing", from: ["paused"] },
  mark_rented: { label: "Mark as rented", from: ["published", "paused"] },
  relist: { label: "Relist (back to draft)", from: ["rented", "archived"] },
  archive: { label: "Archive", from: ["draft", "pending_review", "published", "paused", "rented", "rejected"] },
};

export function ListingActions({ id, slug, status }: { id: string; slug: string; status: ListingStatusValue }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const available = Object.entries(ACTIONS).filter(([, a]) => a.from.includes(status));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Listing actions" disabled={busy}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/landlord/listings/${id}/edit`}>Edit</Link>
          </DropdownMenuItem>
          {status === "published" && (
            <DropdownMenuItem asChild>
              <Link href={`/listing/${slug}`}>View public page</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/landlord/listings/${id}/tours`}>Tour availability</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {available.map(([action, a]) => (
            <DropdownMenuItem
              key={action}
              onSelect={() =>
                run(
                  () =>
                    action === "submit"
                      ? api(`/listings/${id}/submit`, { method: "POST" })
                      : api(`/listings/${id}/status`, { method: "POST", json: { action } }),
                  `${a.label}: done`,
                )
              }
            >
              {a.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onSelect={() =>
              run(async () => {
                const res = await api<{ id: string }>(`/listings/${id}/duplicate`, { method: "POST" });
                router.push(`/landlord/listings/${res.id}/edit`);
              }, "Duplicated as a new draft")
            }
          >
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmDelete(true)}>
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this listing?</DialogTitle>
            <DialogDescription>
              This permanently removes the listing, its photos, floor plans and tour requests. To hide it temporarily,
              pause or archive it instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep listing
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setConfirmDelete(false);
                run(() => api(`/listings/${id}`, { method: "DELETE" }), "Listing deleted");
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
