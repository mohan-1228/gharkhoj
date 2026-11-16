import { formatKathmandu } from "@/lib/format";
import type { Email } from "../lib/mailer";

/**
 * Transactional email templates. Inline styles + plain-text alternative for
 * deliverability. All user-provided text is HTML-escaped.
 */
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:28px">
<tr><td style="font-size:20px;font-weight:700;color:#b91c1c;padding-bottom:16px">GharKhoj</td></tr>
<tr><td style="font-size:18px;font-weight:600;padding-bottom:12px">${esc(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.55">${bodyHtml}</td></tr>
${cta ? `<tr><td style="padding-top:20px"><a href="${esc(cta.url)}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding-top:24px;font-size:12px;color:#777">You are receiving this because of activity on your GharKhoj account. Never pay a deposit before visiting a property.</td></tr>
</table></td></tr></table></body></html>`;
}

const when = (d: Date) => formatKathmandu(d);

export interface TourEmailContext {
  appUrl: string;
  listingTitle: string;
  listingSlug: string;
  renterName: string;
  landlordName: string;
}

export function tourRequestedEmail(
  to: string,
  c: TourEmailContext & { slots: Date[]; message?: string | null },
): Email {
  const list = c.slots.map((s) => `<li>${esc(when(s))}</li>`).join("");
  return {
    to,
    subject: `New tour request: ${c.listingTitle}`,
    html: layout(
      `${c.renterName} wants to visit your property`,
      `<p><strong>${esc(c.listingTitle)}</strong></p><p>Preferred times (Nepal time):</p><ul>${list}</ul>${c.message ? `<p>Message: “${esc(c.message)}”</p>` : ""}<p>Please confirm, propose another time or decline.</p>`,
      { label: "Respond to request", url: `${c.appUrl}/landlord/tours` },
    ),
    text: `${c.renterName} requested a tour of "${c.listingTitle}".\nPreferred times (Nepal time):\n${c.slots.map((s) => `- ${when(s)}`).join("\n")}\n${c.message ? `Message: ${c.message}\n` : ""}Respond: ${c.appUrl}/landlord/tours`,
  };
}

export function tourConfirmedEmail(
  to: string,
  c: TourEmailContext & {
    slot: Date;
    tourId: string;
    forLandlord: boolean;
    address?: string | null;
    landlordPhone?: string | null;
    note?: string | null;
  },
): Email {
  const who = c.forLandlord ? `with ${c.renterName}` : `with ${c.landlordName}`;
  const extra = c.forLandlord
    ? ""
    : `${c.address ? `<p>Address: ${esc(c.address)}</p>` : ""}${c.landlordPhone ? `<p>Landlord phone: ${esc(c.landlordPhone)}</p>` : ""}`;
  return {
    to,
    subject: `Tour confirmed: ${when(c.slot)}`,
    html: layout(
      `Your tour is confirmed`,
      `<p><strong>${esc(c.listingTitle)}</strong> ${esc(who)}</p><p>When: <strong>${esc(when(c.slot))}</strong> (Nepal time)</p>${extra}${c.note ? `<p>Note: “${esc(c.note)}”</p>` : ""}<p><a href="${c.appUrl}/api/v1/tours/${c.tourId}/ics">Add to calendar</a></p>`,
      { label: "View tour", url: `${c.appUrl}/${c.forLandlord ? "landlord" : "account"}/tours` },
    ),
    text: `Tour confirmed: "${c.listingTitle}" ${who} on ${when(c.slot)} (Nepal time).\nAdd to calendar: ${c.appUrl}/api/v1/tours/${c.tourId}/ics`,
  };
}

export function tourDeclinedEmail(to: string, c: TourEmailContext & { note?: string | null }): Email {
  return {
    to,
    subject: `Tour request update: ${c.listingTitle}`,
    html: layout(
      "The landlord couldn't accept your tour request",
      `<p><strong>${esc(c.listingTitle)}</strong></p>${c.note ? `<p>Note from the landlord: “${esc(c.note)}”</p>` : ""}<p>You can browse similar rentals nearby.</p>`,
      { label: "Find similar rentals", url: `${c.appUrl}/listing/${c.listingSlug}` },
    ),
    text: `Your tour request for "${c.listingTitle}" was declined.${c.note ? ` Note: ${c.note}` : ""}`,
  };
}

export function tourRescheduledEmail(to: string, c: TourEmailContext & { slot: Date; note?: string | null }): Email {
  return {
    to,
    subject: `New tour time proposed: ${c.listingTitle}`,
    html: layout(
      "The landlord proposed a different time",
      `<p><strong>${esc(c.listingTitle)}</strong></p><p>Proposed time: <strong>${esc(when(c.slot))}</strong> (Nepal time)</p>${c.note ? `<p>Note: “${esc(c.note)}”</p>` : ""}`,
      { label: "Accept or cancel", url: `${c.appUrl}/account/tours` },
    ),
    text: `${c.landlordName} proposed ${when(c.slot)} for "${c.listingTitle}". Respond: ${c.appUrl}/account/tours`,
  };
}

export function tourCancelledEmail(to: string, c: TourEmailContext & { by: string; slot?: Date | null }): Email {
  return {
    to,
    subject: `Tour cancelled: ${c.listingTitle}`,
    html: layout(
      "A tour was cancelled",
      `<p><strong>${esc(c.listingTitle)}</strong>${c.slot ? ` on ${esc(when(c.slot))}` : ""} was cancelled by ${esc(c.by)}.</p>`,
    ),
    text: `The tour for "${c.listingTitle}" was cancelled by ${c.by}.`,
  };
}

export function tourReminderEmail(
  to: string,
  c: TourEmailContext & { slot: Date; hours: number; forLandlord: boolean },
): Email {
  return {
    to,
    subject: `Reminder: tour in ${c.hours} hour${c.hours > 1 ? "s" : ""}`,
    html: layout(
      `Your tour is coming up`,
      `<p><strong>${esc(c.listingTitle)}</strong></p><p>${esc(when(c.slot))} (Nepal time) with ${esc(c.forLandlord ? c.renterName : c.landlordName)}.</p>`,
      {
        label: "View details",
        url: `${c.appUrl}/${c.forLandlord ? "landlord" : "account"}/tours`,
      },
    ),
    text: `Reminder: tour of "${c.listingTitle}" at ${when(c.slot)} (Nepal time).`,
  };
}

export function listingApprovedEmail(to: string, c: { appUrl: string; title: string; slug: string }): Email {
  return {
    to,
    subject: `Your listing is live: ${c.title}`,
    html: layout(
      "Your listing has been approved",
      `<p><strong>${esc(c.title)}</strong> is now visible to renters.</p>`,
      { label: "View listing", url: `${c.appUrl}/listing/${c.slug}` },
    ),
    text: `"${c.title}" is live: ${c.appUrl}/listing/${c.slug}`,
  };
}

export function listingRejectedEmail(
  to: string,
  c: { appUrl: string; title: string; id: string; reason: string },
): Email {
  return {
    to,
    subject: `Changes needed: ${c.title}`,
    html: layout(
      "Your listing needs changes",
      `<p><strong>${esc(c.title)}</strong> wasn't approved.</p><p>Reason: “${esc(c.reason)}”</p><p>Edit the listing and submit it again.</p>`,
      {
        label: "Edit listing",
        url: `${c.appUrl}/landlord/listings/${c.id}/edit`,
      },
    ),
    text: `"${c.title}" needs changes: ${c.reason}. Edit: ${c.appUrl}/landlord/listings/${c.id}/edit`,
  };
}

export function verificationDecisionEmail(
  to: string,
  c: { appUrl: string; verified: boolean; note?: string | null },
): Email {
  return {
    to,
    subject: c.verified ? "You're verified on GharKhoj" : "Verification update",
    html: layout(
      c.verified ? "Your landlord account is verified" : "We couldn't verify your documents",
      c.verified
        ? "<p>Your listings now show the Verified badge.</p>"
        : `<p>${c.note ? `Reason: “${esc(c.note)}”. ` : ""}Please upload a clearer document.</p>`,
      { label: "Go to dashboard", url: `${c.appUrl}/landlord` },
    ),
    text: c.verified
      ? "Your GharKhoj landlord account is verified."
      : `Verification was not approved.${c.note ? ` Reason: ${c.note}` : ""}`,
  };
}
