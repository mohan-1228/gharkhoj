import Link from "next/link";
import { AlertTriangle, BadgeCheck } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { reviewQueue } from "@/server/services/admin-service";
import { hasContactInfo } from "@/server/services/trust";
import { ReviewActions } from "@/components/admin/review-actions";
import { formatRent } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moderation queue" };

export default async function ReviewPage() {
  const items = await reviewQueue(await getCurrentUser());
  return (
    <div>
      <h1 className="text-2xl font-bold">Moderation queue</h1>
      <p className="text-muted-foreground text-sm">
        {items.length} listing{items.length === 1 ? "" : "s"} waiting, oldest first.
      </p>
      {items.length === 0 && <p className="text-muted-foreground mt-8">All caught up 🎉</p>}
      <ul className="mt-6 space-y-6">
        {items.map((l) => {
          const c = l.flags.contact;
          return (
            <li key={l.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/listing/${l.slug}`} target="_blank" className="text-lg font-semibold hover:underline">
                    {l.title}
                  </Link>
                  <p className="text-muted-foreground text-sm">
                    {PROPERTY_TYPE_LABELS[l.propertyType]} · {l.place} · {formatRent(l.rentNpr)}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm">
                    {l.landlord.name} ({l.landlord.email}) · {l.landlord.listingCount} listing(s)
                    {l.landlord.verified && <BadgeCheck className="size-4 text-emerald-600" aria-label="Verified" />}
                  </p>
                </div>
                <p className="text-muted-foreground text-xs">
                  Submitted {new Date(l.submittedAt).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu" })}
                </p>
              </div>

              {(hasContactInfo(c) || l.flags.duplicates.length > 0 || l.flags.rejectedPhotos > 0) && (
                <ul className="mt-3 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {c.phones.length > 0 && (
                    <li className="flex gap-2">
                      <AlertTriangle className="size-4" />
                      Phone numbers in text: {c.phones.join(", ")}
                    </li>
                  )}
                  {c.emails.length > 0 && (
                    <li className="flex gap-2">
                      <AlertTriangle className="size-4" />
                      Emails in text: {c.emails.join(", ")}
                    </li>
                  )}
                  {c.urls.length > 0 && (
                    <li className="flex gap-2">
                      <AlertTriangle className="size-4" />
                      Links: {c.urls.join(", ")}
                    </li>
                  )}
                  {c.keywords.length > 0 && (
                    <li className="flex gap-2">
                      <AlertTriangle className="size-4" />
                      Scam/off-platform cues: {c.keywords.join(", ")}
                    </li>
                  )}
                  {l.flags.rejectedPhotos > 0 && (
                    <li className="flex gap-2">
                      <AlertTriangle className="size-4" />
                      {l.flags.rejectedPhotos} photo(s) failed image moderation
                    </li>
                  )}
                  {l.flags.duplicates.map((d) => (
                    <li key={d.id} className="flex gap-2">
                      <AlertTriangle className="size-4" />
                      Possible duplicate ({d.reason}):{" "}
                      <Link href={`/listing/${d.slug}`} className="underline" target="_blank">
                        {d.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex gap-2 overflow-x-auto">
                {l.photos.map((p) =>
                  p.urls ? (
                    <img
                      key={p.id}
                      src={p.urls.sm}
                      alt={p.roomLabel ?? ""}
                      className="h-24 w-36 shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      key={p.id}
                      className="bg-muted flex h-24 w-36 shrink-0 items-center justify-center rounded text-xs"
                    >
                      {p.status}
                    </div>
                  ),
                )}
              </div>
              <details className="mt-3 text-sm">
                <summary className="text-muted-foreground cursor-pointer">Description</summary>
                <p className="mt-2 whitespace-pre-line">{l.description}</p>
              </details>
              <ReviewActions id={l.id} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
