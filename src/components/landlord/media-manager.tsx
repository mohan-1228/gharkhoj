"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FileText, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api-client";
import { MAX_PHOTOS_PER_LISTING, UPLOAD_LIMITS } from "@/lib/constants";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import type { FloorPlanDto, PhotoDto } from "@/server/services/media-service";

const ROOM_LABELS = [
  "Living room",
  "Bedroom",
  "Kitchen",
  "Bathroom",
  "Balcony",
  "Exterior",
  "View",
  "Dining",
  "Office",
  "Other",
];

interface Uploading {
  name: string;
  pct: number;
}

export function MediaManager({
  listingId,
  initialPhotos,
  initialFloorPlans,
}: {
  listingId: string;
  initialPhotos: PhotoDto[];
  initialFloorPlans: FloorPlanDto[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [plans, setPlans] = useState(initialFloorPlans);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [dirty, setDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const planInput = useRef<HTMLInputElement>(null);

  async function handlePhotoFiles(files: FileList | File[]) {
    const list = Array.from(files).slice(0, MAX_PHOTOS_PER_LISTING - photos.length);
    for (const file of list) {
      if (!(UPLOAD_LIMITS.photo.types as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: only JPG, PNG or WebP photos are allowed`);
        continue;
      }
      if (file.size > UPLOAD_LIMITS.photo.maxBytes) {
        toast.error(`${file.name}: larger than 10 MB`);
        continue;
      }
      setUploads((u) => [...u, { name: file.name, pct: 0 }]);
      try {
        const key = await uploadFile(file, "photo", listingId, (pct) =>
          setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, pct } : x))),
        );
        const photo = await api<PhotoDto>(`/listings/${listingId}/photos`, { method: "POST", json: { key } });
        setPhotos((p) => [...p, photo]);
        if (photo.status === "rejected") toast.error(`${file.name} was rejected by our content checks`);
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e)}`);
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name));
      }
    }
  }

  async function handlePlanFiles(files: FileList) {
    for (const file of Array.from(files)) {
      if (!(UPLOAD_LIMITS.floor_plan.types as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: floor plans must be JPG, PNG or PDF`);
        continue;
      }
      setUploads((u) => [...u, { name: file.name, pct: 0 }]);
      try {
        const key = await uploadFile(file, "floor_plan", listingId, (pct) =>
          setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, pct } : x))),
        );
        const plan = await api<FloorPlanDto>(`/listings/${listingId}/floor-plans`, {
          method: "POST",
          json: { key, label: file.name.replace(/\.[^.]+$/, "").slice(0, 80) },
        });
        setPlans((p) => [...p, plan]);
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e)}`);
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name));
      }
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    setPhotos((p) => {
      const next = [...p];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
    setDirty(true);
  }

  function setCover(id: string) {
    setPhotos((p) => p.map((x) => ({ ...x, isCover: x.id === id })));
    setDirty(true);
  }

  function patchPhoto(id: string, patch: Partial<PhotoDto>) {
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setDirty(true);
  }

  async function saveOrder() {
    try {
      const res = await api<{ items: PhotoDto[] }>(`/listings/${listingId}/photos`, {
        method: "PATCH",
        json: {
          photos: photos.map((p) => ({ id: p.id, caption: p.caption ?? null, roomLabel: p.roomLabel ?? null })),
          coverId: photos.find((p) => p.isCover)?.id,
        },
      });
      setPhotos(res.items);
      setDirty(false);
      toast.success("Photos saved");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function removePhoto(id: string) {
    try {
      await api(`/listings/${listingId}/photos/${id}`, { method: "DELETE" });
      setPhotos((p) => {
        const rest = p.filter((x) => x.id !== id);
        if (rest.length && !rest.some((x) => x.isCover)) rest[0] = { ...rest[0]!, isCover: true };
        return rest;
      });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function removePlan(id: string) {
    try {
      await api(`/listings/${listingId}/floor-plans/${id}`, { method: "DELETE" });
      setPlans((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <section id="media" className="bg-card scroll-mt-20 space-y-6 rounded-xl border p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Photos</h2>
          <p className="text-muted-foreground text-sm">
            {photos.length}/{MAX_PHOTOS_PER_LISTING} · Drag to reorder. The cover photo appears in search results.
            Location data (EXIF GPS) is removed automatically.
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={saveOrder}>
            Save photo order & captions
          </Button>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => photoInput.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && photoInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void handlePhotoFiles(e.dataTransfer.files);
        }}
        className="text-muted-foreground hover:border-primary hover:text-foreground focus-visible:ring-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <ImagePlus className="size-6" aria-hidden />
        <span>
          <strong>Click to choose</strong> or drop photos here (JPG, PNG, WebP · max 10 MB each)
        </span>
        <input
          ref={photoInput}
          type="file"
          accept={UPLOAD_LIMITS.photo.types.join(",")}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void handlePhotoFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-1" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.name} className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              <span className="truncate">{u.name}</span>
              <span className="ml-auto tabular-nums">{u.pct < 100 ? `${u.pct}%` : "processing…"}</span>
            </li>
          ))}
        </ul>
      )}

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p, i) => (
          <li
            key={p.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
            }}
            className={cn(
              "bg-background overflow-hidden rounded-lg border",
              p.isCover && "ring-primary ring-2",
              p.status === "rejected" && "opacity-60",
            )}
          >
            <div className="bg-muted relative aspect-[3/2]">
              {p.urls ? (
                // eslint-disable-next-line @next/next/no-img-element -- pre-generated variants served from CloudFront
                <img
                  src={p.urls.sm}
                  alt={p.caption ?? p.roomLabel ?? `Photo ${i + 1}`}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
                  {p.status === "rejected" ? "Rejected — please remove" : "Processing…"}
                </div>
              )}
              {p.isCover && (
                <span className="bg-primary text-primary-foreground absolute top-2 left-2 rounded px-2 py-0.5 text-xs font-medium">
                  Cover
                </span>
              )}
            </div>
            <div className="space-y-2 p-2">
              <div className="flex gap-2">
                <select
                  aria-label={`Room for photo ${i + 1}`}
                  value={p.roomLabel ?? ""}
                  onChange={(e) => patchPhoto(p.id, { roomLabel: e.target.value || null })}
                  className="h-8 flex-1 rounded-md border bg-transparent px-2 text-xs"
                >
                  <option value="">Room…</option>
                  {ROOM_LABELS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Move earlier"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Move later"
                  disabled={i === photos.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
              <Input
                aria-label={`Caption for photo ${i + 1}`}
                placeholder="Caption (optional)"
                className="h-8 text-xs"
                value={p.caption ?? ""}
                maxLength={200}
                onChange={(e) => patchPhoto(p.id, { caption: e.target.value })}
              />
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={p.isCover || p.status !== "ready"}
                  onClick={() => setCover(p.id)}
                >
                  <Star className="size-4" /> Make cover
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => removePhoto(p.id)}
                >
                  <Trash2 className="size-4" /> Remove
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Floor plans</h2>
            <p className="text-muted-foreground text-sm">Optional. JPG, PNG or PDF, max 15 MB.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => planInput.current?.click()}>
            <FileText className="size-4" /> Add floor plan
          </Button>
          <input
            ref={planInput}
            type="file"
            accept={UPLOAD_LIMITS.floor_plan.types.join(",")}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void handlePlanFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {plans.length > 0 && (
          <ul className="mt-4 divide-y rounded-lg border">
            {plans.map((f) => (
              <li key={f.id} className="flex items-center gap-3 p-3 text-sm">
                {f.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- pre-generated variant
                  <img src={f.thumbUrl} alt="" className="size-12 rounded object-cover" />
                ) : (
                  <FileText className="text-muted-foreground size-8" aria-hidden />
                )}
                <span className="flex-1 truncate">{f.label ?? "Floor plan"}</span>
                {f.url && (
                  <a href={f.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    View
                  </a>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${f.label ?? "floor plan"}`}
                  onClick={() => removePlan(f.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
