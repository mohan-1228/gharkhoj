import { prisma } from "../lib/db";

/**
 * Trust & safety heuristics (CLAUDE.md §4.8). These FLAG listings for a human
 * moderator; nothing is auto-rejected on heuristics alone.
 */

const PHONE = /(?:\+?977[\s-]?)?\b9[678]\d[\s-]?\d{3}[\s-]?\d{4}\b/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const OFF_PLATFORM =
  /\b(whats\s?app|viber|imo|telegram|advance payment|pay (the )?deposit (first|before)|esewa|khalti)\b/gi;

export interface ContactFlags {
  phones: string[];
  emails: string[];
  urls: string[];
  keywords: string[];
}

export function detectContactInfo(text: string): ContactFlags {
  const uniq = (m: RegExpMatchArray | null) => [...new Set((m ?? []).map((x) => x.trim()))];
  return {
    phones: uniq(text.match(PHONE)),
    emails: uniq(text.match(EMAIL)),
    urls: uniq(text.match(URL_RE)),
    keywords: uniq(text.match(OFF_PLATFORM)).map((k) => k.toLowerCase()),
  };
}

export function hasContactInfo(f: ContactFlags): boolean {
  return f.phones.length + f.emails.length + f.urls.length + f.keywords.length > 0;
}

/** Possible duplicates: same landlord + same title, or any live listing within 30 m at a similar rent. */
export async function findPossibleDuplicates(
  listingId: string,
): Promise<{ id: string; slug: string; title: string; reason: string }[]> {
  return prisma.$queryRaw<{ id: string; slug: string; title: string; reason: string }[]>`
    SELECT o.id::text, o.slug, o.title,
           CASE WHEN o.landlord_id = l.landlord_id AND lower(o.title) = lower(l.title) THEN 'same title by same landlord'
                ELSE 'within 30 m at a similar rent' END AS reason
      FROM listings l
      JOIN listings o ON o.id <> l.id AND o.status IN ('published', 'pending_review', 'paused')
     WHERE l.id = ${listingId}::uuid
       AND (
         (o.landlord_id = l.landlord_id AND lower(o.title) = lower(l.title))
         OR (l.location IS NOT NULL AND o.location IS NOT NULL
             AND ST_DWithin(o.location, l.location, 30)
             AND o.rent_npr BETWEEN l.rent_npr * 0.9 AND l.rent_npr * 1.1)
       )
     LIMIT 5`;
}
