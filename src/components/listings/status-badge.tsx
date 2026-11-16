import { Badge } from "@/components/ui/badge";
import { LISTING_STATUS_LABELS, type ListingStatusValue } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STYLES: Record<ListingStatusValue, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  published: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  paused: "bg-slate-200 text-slate-800",
  rented: "bg-sky-100 text-sky-900",
  archived: "bg-muted text-muted-foreground line-through",
  rejected: "bg-red-100 text-red-900",
};

export function ListingStatusBadge({ status }: { status: ListingStatusValue }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", STYLES[status])}>
      {LISTING_STATUS_LABELS[status]}
    </Badge>
  );
}
