"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api-client";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  return (
    <section className="border-destructive/40 rounded-xl border p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Delete account</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Permanently deletes your profile, favourites, saved searches, tour requests and any listings you own.
      </p>
      <Button variant="destructive" className="mt-3" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>This cannot be undone. Type DELETE to confirm.</DialogDescription>
          </DialogHeader>
          <Input aria-label="Type DELETE to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== "DELETE"}
              onClick={async () => {
                try {
                  await api("/me", { method: "DELETE" });
                  window.location.assign("/");
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
