import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Help & safety", alternates: { canonical: "/help" } };

const FAQ: [string, React.ReactNode][] = [
  [
    "How do I find a place?",
    <>
      Use{" "}
      <Link href="/rent" className="text-primary underline">
        search
      </Link>{" "}
      to filter by city, price, bedrooms, water supply and more, or switch to the map view to search a specific area.
    </>,
  ],
  [
    "How do tours work?",
    "Open a listing, choose up to three times that suit you and send the request. The landlord confirms one, proposes another time, or declines. You get an email at each step and a reminder before the visit.",
  ],
  [
    "Why is the location approximate?",
    "Some landlords prefer not to show their exact address publicly. You will receive the full address once your tour is confirmed.",
  ],
  [
    "How do I list my property?",
    <>
      Create an account, choose{" "}
      <Link href="/account/become-landlord" className="text-primary underline">
        become a landlord
      </Link>
      , then add details, photos and a map pin. Every listing is reviewed before it goes live.
    </>,
  ],
  [
    "What does the Verified badge mean?",
    "The landlord uploaded a citizenship certificate or ownership document and our team confirmed it matches their account.",
  ],
  [
    "How do I delete my account?",
    <>
      Go to{" "}
      <Link href="/account" className="text-primary underline">
        Account settings
      </Link>{" "}
      and choose “Delete my account”.
    </>,
  ],
];

export default function HelpPage() {
  return (
    <ProsePage title="Help & safety">
      <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <h2 className="!mt-0">Stay safe</h2>
        <ul>
          <li>Never pay a deposit or “booking fee” before visiting the property in person.</li>
          <li>
            Be cautious if someone asks you to pay via eSewa/Khalti or move the conversation to WhatsApp before a visit.
          </li>
          <li>See something suspicious? Use “Report listing” on the listing page.</li>
        </ul>
      </section>
      <h2>Frequently asked questions</h2>
      {FAQ.map(([q, a]) => (
        <details key={q} className="mt-3 rounded-lg border p-3">
          <summary className="cursor-pointer font-medium">{q}</summary>
          <p className="text-muted-foreground !mt-2">{a}</p>
        </details>
      ))}
    </ProsePage>
  );
}
