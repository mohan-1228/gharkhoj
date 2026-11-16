"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

/** Heart toggle with optimistic update. Signed-out users are sent to sign in. */
export function FavoriteButton({
  listingId,
  className,
  withLabel = false,
}: {
  listingId: string;
  className?: string;
  withLabel?: boolean;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useSession();
  const { data } = useQuery({
    queryKey: ["favorite-ids"],
    queryFn: () => api<{ ids: string[] }>("/favorites/ids"),
    enabled: !!me,
    staleTime: 60_000,
  });
  const active = !!data?.ids.includes(listingId);

  const mutation = useMutation({
    mutationFn: (next: boolean) => api(`/favorites/${listingId}`, { method: next ? "POST" : "DELETE" }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["favorite-ids"] });
      const prev = qc.getQueryData<{ ids: string[] }>(["favorite-ids"]);
      qc.setQueryData<{ ids: string[] }>(["favorite-ids"], (old) => ({
        ids: next ? [...(old?.ids ?? []), listingId] : (old?.ids ?? []).filter((x) => x !== listingId),
      }));
      return { prev };
    },
    onError: (e, _next, ctx) => {
      qc.setQueryData(["favorite-ids"], ctx?.prev);
      toast.error(errorMessage(e));
    },
    onSuccess: (_d, next) => toast.success(next ? "Saved to favourites" : "Removed from favourites"),
  });

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Remove from favourites" : "Save to favourites"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!me) {
          router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }
        mutation.mutate(!active);
      }}
      className={cn(
        "bg-background/90 flex items-center gap-1.5 rounded-full p-2 shadow-sm transition hover:scale-105",
        withLabel && "px-3",
        className,
      )}
    >
      <Heart className={cn("size-5", active ? "fill-primary text-primary" : "text-foreground")} />
      {withLabel && <span className="text-sm font-medium">{active ? "Saved" : "Save"}</span>}
    </button>
  );
}
