"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/forms/field";
import { api, errorMessage } from "@/lib/api-client";
import { useSession } from "@/hooks/use-session";

export function SaveSearchButton() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [freq, setFreq] = useState<"none" | "daily" | "weekly">("weekly");

  function filters(): Record<string, string> {
    const f: Record<string, string> = Object.fromEntries(
      [...sp.entries()].filter(([k]) => !["page", "view"].includes(k)),
    );
    // SEO paths (/rent/kathmandu/baneshwor) encode filters in the path.
    const [, , city, segment] = pathname.split("/");
    if (city) f.city ??= city;
    if (segment) f.segment = segment;
    return f;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => (me ? setOpen(true) : router.push(`/login?returnTo=${encodeURIComponent(pathname)}`))}
      >
        <Bookmark className="size-4" /> <span className="hidden sm:inline">Save search</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              aria-label="Name"
              placeholder="e.g. 2BHK under 30K in Lalitpur"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
            <NativeSelect
              aria-label="Email alerts"
              value={freq}
              onChange={(e) => setFreq(e.target.value as typeof freq)}
            >
              <option value="weekly">Email me new matches weekly</option>
              <option value="daily">Email me new matches daily</option>
              <option value="none">No emails</option>
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button
              disabled={!name.trim()}
              onClick={async () => {
                try {
                  await api("/saved-searches", {
                    method: "POST",
                    json: { name, filters: filters(), alertFrequency: freq },
                  });
                  toast.success("Search saved");
                  setOpen(false);
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
