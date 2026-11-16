import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/session";
import { getMe } from "@/server/services/auth-service";
import { ProfileForm } from "@/components/account/profile-form";
import { DangerZone } from "@/components/account/danger-zone";
import { RecentlyViewedList } from "@/components/listings/recently-viewed";
import { AccountNav } from "@/components/account/account-nav";

export const metadata: Metadata = { title: "Account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await getMe(await getCurrentUser());
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Your account</h1>
      <AccountNav current="/account" />
      <div className="mt-6 space-y-8">
        <ProfileForm
          isLandlord={me.role !== "renter"}
          defaults={{
            fullName: me.fullName,
            phone: me.phone ?? "",
            businessName: me.landlordProfile?.businessName ?? "",
            bio: me.landlordProfile?.bio ?? "",
          }}
          email={me.email}
          role={me.role}
        />
        <section className="rounded-xl border p-4 sm:p-6">
          <h2 className="mb-3 text-lg font-semibold">Recently viewed</h2>
          <RecentlyViewedList />
        </section>
        <DangerZone />
      </div>
    </div>
  );
}
