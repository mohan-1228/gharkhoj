"use client";

import dynamic from "next/dynamic";
import type { SearchMapProps } from "./search-map-client";

const SearchMapClient = dynamic(() => import("./search-map-client"), {
  ssr: false,
  loading: () => <div className="bg-muted h-[65vh] min-h-[420px] w-full animate-pulse rounded-xl" />,
});

export function SearchMapLoader(props: SearchMapProps) {
  return <SearchMapClient {...props} />;
}
