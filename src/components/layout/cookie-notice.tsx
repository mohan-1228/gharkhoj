"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "gk_cookie_notice_v1";

/** Informational notice: we only use essential cookies, so no consent gating is needed. */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem(KEY));
    } catch {
      /* storage blocked */
    }
  }, []);
  if (!show) return null;
  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="bg-background fixed inset-x-2 bottom-20 z-50 mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-xl border p-3 text-sm shadow-lg sm:bottom-4"
    >
      <p className="flex-1">
        We use one essential cookie to keep you signed in — no ads or tracking.{" "}
        <Link href="/privacy" className="text-primary underline">
          Privacy Policy
        </Link>
      </p>
      <Button
        size="sm"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* ignore */
          }
          setShow(false);
        }}
      >
        OK
      </Button>
    </div>
  );
}
