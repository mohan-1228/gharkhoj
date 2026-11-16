"use client";

import { useQueryStates } from "nuqs";
import { NativeSelect } from "@/components/forms/field";
import { SORT_LABELS, SORT_OPTIONS } from "@/lib/constants";
import { searchParsers } from "./search-params";

export function SortSelect({ canSortByDistance }: { canSortByDistance: boolean }) {
  const [f, setF] = useQueryStates(searchParsers, { shallow: false, history: "push" });
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort</span>
      <NativeSelect
        className="h-8 w-auto"
        value={f.sort ?? "newest"}
        onChange={(e) => setF({ sort: e.target.value as (typeof SORT_OPTIONS)[number], page: null })}
      >
        {SORT_OPTIONS.filter((s) => s !== "nearest" || canSortByDistance).map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
