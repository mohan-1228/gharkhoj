import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Crawlable pagination (real links) — better for SEO and low-end devices than infinite scroll. */
export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  const window = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b);
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          className="flex h-9 items-center rounded-md border px-2"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Link>
      )}
      {window.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - window[i - 1]! > 1 && <span className="text-muted-foreground px-1">…</span>}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm",
              p === page && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          className="flex h-9 items-center rounded-md border px-2"
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Link>
      )}
    </nav>
  );
}
