import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/lib/db";
import { VerificationUpload } from "@/components/landlord/verification-upload";

export const metadata: Metadata = { title: "Get verified", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const user = await getCurrentUser();
  const profile = user ? await prisma.landlordProfile.findUnique({ where: { userId: user.id } }) : null;
  const status = profile?.verificationStatus ?? "unverified";
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <BadgeCheck className="size-6 text-emerald-600" /> Get the Verified badge
      </h1>
      <p className="text-muted-foreground mt-2">
        Upload a photo or scan of your citizenship certificate (nagarikta) or land ownership document (lalpurja). It is
        stored privately, seen only by our review team, and never shown to renters.
      </p>
      {status === "verified" && (
        <p className="mt-6 rounded-md bg-emerald-50 p-4 text-emerald-900">
          You&apos;re verified. Your listings show the Verified badge.
        </p>
      )}
      {status === "pending" && (
        <p className="mt-6 rounded-md bg-amber-50 p-4 text-amber-900">
          Your document is being reviewed. We&apos;ll email you within 2 working days.
        </p>
      )}
      {status === "rejected" && profile?.verificationNote && (
        <p className="mt-6 rounded-md bg-red-50 p-4 text-red-900">
          Previous submission was not accepted: {profile.verificationNote}
        </p>
      )}
      {(status === "unverified" || status === "rejected") && <VerificationUpload />}
    </div>
  );
}
