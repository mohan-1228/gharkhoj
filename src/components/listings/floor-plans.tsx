"use client";

import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { FileText } from "lucide-react";
import type { FloorPlanDto } from "@/server/services/media-service";

/** Floor plan viewer: images open in a zoomable lightbox; PDFs open in a new tab. */
export function FloorPlans({ plans }: { plans: FloorPlanDto[] }) {
  const images = plans.filter((p) => p.fileType === "image" && p.url);
  const [index, setIndex] = useState(-1);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {plans.map((p) => (
          <li key={p.id}>
            {p.fileType === "image" ? (
              <button
                type="button"
                onClick={() => setIndex(images.findIndex((x) => x.id === p.id))}
                className="block w-full overflow-hidden rounded-lg border text-left hover:shadow"
              >
                <img
                  src={p.thumbUrl!}
                  alt={p.label ?? "Floor plan"}
                  className="aspect-[4/3] w-full bg-white object-contain"
                  loading="lazy"
                />
                <span className="block p-2 text-sm">{p.label ?? "Floor plan"}</span>
              </button>
            ) : (
              <a
                href={p.url!}
                target="_blank"
                rel="noreferrer"
                className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border text-sm hover:shadow"
              >
                <FileText className="text-muted-foreground size-8" aria-hidden />
                {p.label ?? "Floor plan (PDF)"}
              </a>
            )}
          </li>
        ))}
      </ul>
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        plugins={[Zoom]}
        slides={images.map((p) => ({ src: p.url!, alt: p.label ?? "Floor plan" }))}
      />
    </>
  );
}
