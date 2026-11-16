"use client";

import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import type { PhotoDto } from "@/server/services/media-service";

/** Swipeable photo carousel (Embla) with fullscreen zoomable lightbox. */
export function Gallery({ photos, title }: { photos: PhotoDto[]; title: string }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: photos.length > 1 });
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const onSelect = useCallback(() => embla && setIndex(embla.selectedScrollSnap()), [embla]);
  useEffect(() => {
    if (!embla) return;
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla, onSelect]);

  const ready = photos.filter((p) => p.urls);
  if (ready.length === 0) {
    return (
      <div className="bg-muted text-muted-foreground flex aspect-[16/9] items-center justify-center rounded-xl">
        No photos yet
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className="bg-muted overflow-hidden rounded-xl"
        ref={emblaRef}
        aria-roledescription="carousel"
        aria-label={`Photos of ${title}`}
      >
        <div className="flex">
          {ready.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="relative aspect-[16/10] min-w-0 flex-[0_0_100%] sm:aspect-[16/9]"
              onClick={() => setOpen(true)}
              aria-label={`Open photo ${i + 1} of ${ready.length} fullscreen`}
              aria-roledescription="slide"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- responsive WebP variants */}
              <img
                src={p.urls!.lg}
                srcSet={`${p.urls!.sm} 320w, ${p.urls!.md} 640w, ${p.urls!.lg} 1280w`}
                sizes="(min-width: 1024px) 66vw, 100vw"
                alt={p.caption ?? p.roomLabel ?? `${title} — photo ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
      {ready.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => embla?.scrollPrev()}
            className="bg-background/90 absolute top-1/2 left-2 -translate-y-1/2 rounded-full p-2 shadow"
            aria-label="Previous photo"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => embla?.scrollNext()}
            className="bg-background/90 absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 shadow"
            aria-label="Next photo"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
      <div className="absolute right-2 bottom-2 flex items-center gap-2">
        <span className="rounded-md bg-black/60 px-2 py-0.5 text-xs text-white" aria-live="polite">
          {index + 1} / {ready.length}
          {ready[index]?.roomLabel ? ` · ${ready[index]!.roomLabel}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-black/60 p-1 text-white"
          aria-label="View fullscreen"
        >
          <Expand className="size-4" />
        </button>
      </div>
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={index}
        on={{ view: ({ index: i }) => embla?.scrollTo(i, true) }}
        plugins={[Zoom, Captions]}
        slides={ready.map((p) => ({
          src: p.urls!.lg,
          alt: p.caption ?? p.roomLabel ?? title,
          title: p.roomLabel ?? undefined,
          description: p.caption ?? undefined,
          width: p.width ?? undefined,
          height: p.height ?? undefined,
          srcSet: [
            { src: p.urls!.md, width: 640, height: p.height && p.width ? Math.round((640 * p.height) / p.width) : 427 },
            {
              src: p.urls!.lg,
              width: 1280,
              height: p.height && p.width ? Math.round((1280 * p.height) / p.width) : 853,
            },
          ],
        }))}
      />
    </div>
  );
}
