import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Terms of Service", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <ProsePage title="Terms of Service" updated="16 November 2026">
      <p>By using GharKhoj you agree to these terms. If you do not agree, please do not use the service.</p>
      <h2>Our role</h2>
      <p>
        GharKhoj is a listing platform. We are not a party to any rental agreement, do not collect rent or deposits, and
        do not inspect properties. Agreements are solely between landlords and renters.
      </p>
      <h2>Listing accuracy (landlords)</h2>
      <ul>
        <li>You must own the property or be authorised to rent it out.</li>
        <li>
          Listings, photos and prices must be accurate and current. Mark a property as rented when it is no longer
          available.
        </li>
        <li>Do not include payment instructions or ask for deposits before a visit.</li>
        <li>
          Tenant preferences (family, students, etc.) are shown transparently as you set them. Discrimination beyond
          these stated preferences is not allowed.
        </li>
        <li>We may edit, pause or remove listings that break these terms, and suspend accounts involved in fraud.</li>
      </ul>
      <h2>Renters</h2>
      <ul>
        <li>
          Visit a property and verify the landlord before paying anything. Never send a deposit to someone you have not
          met.
        </li>
        <li>Use tour requests for genuine interest only, and cancel if your plans change.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>No spam, scraping, automated account creation, harassment or attempts to bypass security controls.</p>
      <h2>Liability</h2>
      <p>
        The service is provided “as is”. To the extent permitted by the laws of Nepal, GharKhoj is not liable for losses
        arising from agreements between users or from listing content provided by landlords.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms; material changes will be announced on the site. Continued use means you accept the
        updated terms.
      </p>
    </ProsePage>
  );
}
