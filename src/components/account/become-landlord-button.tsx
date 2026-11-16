"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";

export function BecomeLandlordButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className="mt-6"
      size="lg"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api("/me/become-landlord", { method: "POST" });
          window.location.assign("/landlord/listings/new");
        } catch (e) {
          toast.error(errorMessage(e));
          setBusy(false);
        }
      }}
    >
      Switch my account to landlord
    </Button>
  );
}
