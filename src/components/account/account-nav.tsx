import Link from "next/link";
import { cn } from "@/lib/utils";

const ITEMS = [
  ["/account", "Profile"],
  ["/account/favorites", "Favourites"],
  ["/account/tours", "Tours"],
  ["/account/searches", "Saved searches"],
] as const;

export function AccountNav({ current }: { current: string }) {
  return (
    <nav aria-label="Account" className="mt-4 flex gap-1 overflow-x-auto border-b">
      {ITEMS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className={cn(
            "border-b-2 px-3 py-2 text-sm whitespace-nowrap",
            current === href
              ? "border-primary font-medium"
              : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
