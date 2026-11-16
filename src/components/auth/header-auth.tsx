"use client";

import Link from "next/link";
import { Heart, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { UserMenu } from "./user-menu";

export function HeaderAuth({
  labels,
}: {
  labels: { favorites: string; dashboard: string; listProperty: string; signIn: string };
}) {
  const { data: user, isLoading } = useSession();
  if (isLoading) return <div className="bg-muted h-8 w-20 animate-pulse rounded-md" aria-hidden />;
  if (!user) {
    return (
      <>
        <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
          <Link href="/landlord/listings/new">
            <Plus className="size-4" /> {labels.listProperty}
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/login">{labels.signIn}</Link>
        </Button>
      </>
    );
  }
  return (
    <>
      <Button asChild variant="ghost" size="icon" aria-label={labels.favorites}>
        <Link href="/account/favorites">
          <Heart className="size-5" />
        </Link>
      </Button>
      {user.role !== "renter" && (
        <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
          <Link href="/landlord">{labels.dashboard}</Link>
        </Button>
      )}
      <UserMenu user={user} />
    </>
  );
}
