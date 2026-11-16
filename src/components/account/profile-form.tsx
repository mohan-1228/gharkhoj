"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { api, errorMessage } from "@/lib/api-client";

export function ProfileForm({
  defaults,
  email,
  role,
  isLandlord,
}: {
  defaults: { fullName: string; phone: string; businessName: string; bio: string };
  email: string;
  role: string;
  isLandlord: boolean;
}) {
  const [v, setV] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  return (
    <form
      className="space-y-4 rounded-xl border p-4 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/me", { method: "PATCH", json: { ...v, phone: v.phone || null } });
          await qc.invalidateQueries({ queryKey: ["me"] });
          toast.success("Profile saved");
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Profile</h2>
        <span className="bg-muted rounded-full px-3 py-1 text-xs capitalize">{role}</span>
      </div>
      <p className="text-muted-foreground text-sm">Signed in as {email}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="fullName" label="Full name" required>
          <Input
            id="fullName"
            value={v.fullName}
            onChange={(e) => setV({ ...v, fullName: e.target.value })}
            required
            minLength={2}
          />
        </Field>
        <Field id="phone" label="Mobile number" hint="Shared with a landlord only when you request a tour">
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="98XXXXXXXX"
            value={v.phone}
            onChange={(e) => setV({ ...v, phone: e.target.value })}
          />
        </Field>
        {isLandlord && (
          <>
            <Field id="businessName" label="Business name (optional)">
              <Input
                id="businessName"
                value={v.businessName}
                onChange={(e) => setV({ ...v, businessName: e.target.value })}
              />
            </Field>
            <Field id="bio" label="About you" className="sm:col-span-2">
              <Textarea
                id="bio"
                rows={3}
                value={v.bio}
                onChange={(e) => setV({ ...v, bio: e.target.value })}
                maxLength={1000}
              />
            </Field>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!isLandlord ? (
          <Link href="/account/become-landlord" className="text-primary text-sm hover:underline">
            Have a place to rent out? Become a landlord →
          </Link>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
