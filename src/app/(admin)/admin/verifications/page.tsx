import { getCurrentUser } from "@/server/auth/session";
import { pendingVerifications } from "@/server/services/admin-service";
import { VerificationActions } from "@/components/admin/verification-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verifications" };

export default async function VerificationsPage() {
  const items = await pendingVerifications(await getCurrentUser());
  return (
    <div>
      <h1 className="text-2xl font-bold">Landlord verification</h1>
      <p className="text-muted-foreground text-sm">
        Check that the name on the citizenship certificate or ownership document (lalpurja) matches the account.
        Documents open via a 5-minute private link; each view is audit-logged.
      </p>
      {items.length === 0 && <p className="text-muted-foreground mt-8">No pending verifications.</p>}
      <ul className="mt-6 space-y-4">
        {items.map((v) => (
          <li key={v.userId} className="rounded-xl border p-4">
            <p className="font-medium">
              {v.name}
              {v.businessName ? ` · ${v.businessName}` : ""}
            </p>
            <p className="text-muted-foreground text-sm">
              {v.email}
              {v.phone ? ` · ${v.phone}` : ""} · {v.listings} listing(s) · member since{" "}
              {new Date(v.memberSince).getFullYear()}
            </p>
            <a
              href={`/api/v1/admin/verifications/${v.userId}/document`}
              target="_blank"
              rel="noreferrer"
              className="text-primary mt-2 inline-block text-sm underline"
            >
              Open document
            </a>
            <VerificationActions userId={v.userId} />
          </li>
        ))}
      </ul>
    </div>
  );
}
