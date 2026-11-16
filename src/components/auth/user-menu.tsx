"use client";

import Link from "next/link";
import { CircleUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";

export function UserMenu({ user }: { user: { fullName: string; email: string; role: string } }) {
  async function signOut() {
    const res = await api<{ redirect: string }>("/auth/logout", { method: "POST" }).catch(() => ({ redirect: "/" }));
    window.location.assign(res.redirect);
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Account menu">
          <CircleUser className="size-5" />
          <span className="hidden max-w-32 truncate sm:inline">{user.fullName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal">
          <span className="block font-medium">{user.fullName}</span>
          <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(user.role === "landlord" || user.role === "admin") && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/landlord">Landlord dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/landlord/listings">My listings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/landlord/tours">Tour requests</Link>
            </DropdownMenuItem>
          </>
        )}
        {user.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">Admin</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/favorites">Favourites</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/tours">My tours</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/searches">Saved searches</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account">Account settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
