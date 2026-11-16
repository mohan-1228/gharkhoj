"use client";

import { useQuery } from "@tanstack/react-query";

export interface Me {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: "renter" | "landlord" | "admin";
}

/** Client-side session (keeps public pages cacheable — the server HTML is identical for everyone). */
export function useSession() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const res = await fetch("/api/v1/me", { credentials: "same-origin" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}
