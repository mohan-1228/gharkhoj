import type { Metadata } from "next";
import { BecomeLandlordButton } from "@/components/account/become-landlord-button";

export const metadata: Metadata = { title: "Become a landlord", robots: { index: false } };

export default function BecomeLandlordPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold">List your property on GharKhoj</h1>
      <ul className="text-muted-foreground mt-4 list-disc space-y-1 pl-5">
        <li>Listing is free.</li>
        <li>Every listing is reviewed by our team before it goes live.</li>
        <li>Upload your citizenship or ownership document later to earn the Verified badge.</li>
      </ul>
      <BecomeLandlordButton />
    </div>
  );
}
