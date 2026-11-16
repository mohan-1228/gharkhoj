import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy" updated="16 November 2026">
      <p>
        GharKhoj (“we”) runs a rental marketplace for Nepal. This policy explains what personal data we collect, why,
        and your choices. We collect the minimum needed to run the service.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> name, email, and optionally your mobile number. Sign-in is handled by Amazon
          Cognito; we never see or store your password.
        </li>
        <li>
          <strong>Listings (landlords):</strong> property details, photos, floor plans and the map location you provide.
          Photo location data (EXIF GPS) is removed automatically on upload.
        </li>
        <li>
          <strong>Tour requests (renters):</strong> preferred times, your message and the contact number you enter for
          that request.
        </li>
        <li>
          <strong>Verification documents (landlords, optional):</strong> stored privately and viewed only by our review
          team through short-lived links. Every view is logged.
        </li>
        <li>
          <strong>Technical logs:</strong> request logs (with IP address) kept for up to 30 days for security and
          debugging.
        </li>
      </ul>
      <h2>Who sees what</h2>
      <ul>
        <li>
          Landlords see the name and contact number you include in a tour request for <em>their</em> listing.
        </li>
        <li>Renters see a landlord&apos;s phone number and the exact address only after a tour is confirmed.</li>
        <li>If a landlord chooses “approximate location”, we never send the exact coordinates to browsers.</li>
        <li>
          We do not sell personal data. Service providers (Amazon Web Services in the Mumbai region, OpenStreetMap for
          map tiles and address search) process data on our behalf.
        </li>
      </ul>
      <h2>Cookies and local storage</h2>
      <p>
        We use one essential, first-party cookie to keep you signed in, and your browser&apos;s local storage to
        remember listings you recently viewed on that device. We do not use advertising or cross-site tracking cookies.
      </p>
      <h2>Your rights</h2>
      <ul>
        <li>
          Edit your profile at any time in{" "}
          <a className="text-primary underline" href="/account">
            Account settings
          </a>
          .
        </li>
        <li>
          Delete your account and data instantly from Account settings → Delete account. Backups containing your data
          are overwritten within 7 days.
        </li>
        <li>Questions or requests: contact the support email shown on the Help page.</li>
      </ul>
      <h2>Security</h2>
      <p>
        Data is encrypted in transit (HTTPS) and at rest. Access is restricted by role, and administrative actions are
        recorded in an audit log.
      </p>
    </ProsePage>
  );
}
