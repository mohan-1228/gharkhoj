"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/forms/field";
import { api, errorMessage } from "@/lib/api-client";

/** Local development sign-in (AUTH_MODE=dev). Never available in production. */
export function DevLoginPanel({
  returnTo,
  demoUsers,
}: {
  returnTo: string;
  demoUsers: { email: string; fullName: string; role: string }[];
}) {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"renter" | "landlord">("renter");

  async function login(body: { email: string; role?: "renter" | "landlord"; fullName?: string }) {
    setBusy(true);
    try {
      const res = await api<{ role: string }>("/auth/dev-login", { method: "POST", json: body });
      window.location.assign(
        returnTo !== "/" ? returnTo : res.role === "admin" ? "/admin" : res.role === "landlord" ? "/landlord" : "/rent",
      );
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        Development mode: no password needed. In production this page uses Amazon Cognito.
      </p>
      {demoUsers.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Demo accounts</h2>
          {demoUsers.map((u) => (
            <Button
              key={u.email}
              variant="outline"
              className="w-full justify-between"
              disabled={busy}
              onClick={() => login({ email: u.email })}
            >
              <span>{u.fullName}</span>
              <span className="text-muted-foreground text-xs capitalize">{u.role}</span>
            </Button>
          ))}
        </div>
      )}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void login({ email, role });
        }}
      >
        <h2 className="text-sm font-medium">Or use any email</h2>
        <Input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <NativeSelect
          value={role}
          onChange={(e) => setRole(e.target.value as "renter" | "landlord")}
          aria-label="Account type for new accounts"
        >
          <option value="renter">New account: renter</option>
          <option value="landlord">New account: landlord</option>
        </NativeSelect>
        <Button type="submit" className="w-full" disabled={busy}>
          Continue
        </Button>
      </form>
    </div>
  );
}
