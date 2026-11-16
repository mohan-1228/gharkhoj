"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function DeleteSavedSearch({ id }: { id: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Delete saved search"
      onClick={async () => {
        await api(`/saved-searches/${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
