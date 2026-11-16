"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRent } from "@/lib/format";

/** Recently viewed listings, kept on-device only (no server tracking — privacy by default). */
interface Viewed {
  slug: string;
  title: string;
  rentNpr: number;
  image: string | null;
  place: string;
}
const KEY = "gk_recently_viewed";

function read(): Viewed[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Viewed[];
  } catch {
    return [];
  }
}

export function RecordView({ item }: { item: Viewed }) {
  useEffect(() => {
    try {
      const list = [item, ...read().filter((x) => x.slug !== item.slug)].slice(0, 12);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable (private mode) — ignore */
    }
  }, [item]);
  return null;
}

export function RecentlyViewedList() {
  const [items, setItems] = useState<Viewed[] | null>(null);
  useEffect(() => setItems(read()), []);
  if (items === null) return null;
  if (items.length === 0) return <p className="text-muted-foreground text-sm">Listings you open will appear here.</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((i) => (
        <li key={i.slug}>
          <Link href={`/listing/${i.slug}`} className="hover:bg-muted/50 flex gap-3 rounded-lg border p-2">
            {i.image ? (
              <img src={i.image} alt="" className="size-16 rounded object-cover" />
            ) : (
              <div className="bg-muted size-16 rounded" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{i.title}</span>
              <span className="text-muted-foreground block text-xs">{i.place}</span>
              <span className="block text-sm">{formatRent(i.rentNpr)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
