"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** WhatsApp / Facebook / copy link, plus the native share sheet on mobile. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const text = encodeURIComponent(`${title} — ${url}`);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          if (navigator.share) {
            await navigator.share({ title, url }).catch(() => undefined);
          } else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }
        }}
      >
        <Share2 className="size-4" /> Share
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={`https://wa.me/?text=${text}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noreferrer"
        >
          Facebook
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />} {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
