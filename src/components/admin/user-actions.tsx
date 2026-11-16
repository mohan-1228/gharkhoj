"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/forms/field";
import { api, errorMessage } from "@/lib/api-client";

export function UserActions({ id, role, banned }: { id: string; role: string; banned: boolean }) {
  const router = useRouter();
  const run = async (path: string, body: unknown, msg: string) => {
    try {
      await api(path, { method: "POST", json: body });
      toast.success(msg);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        className="h-8 w-28"
        aria-label="Role"
        value={role}
        onChange={(e) => run(`/admin/users/${id}/role`, { role: e.target.value }, "Role updated")}
      >
        <option value="renter">Renter</option>
        <option value="landlord">Landlord</option>
        <option value="admin">Admin</option>
      </NativeSelect>
      <Button
        size="sm"
        variant={banned ? "outline" : "destructive"}
        onClick={() => run(`/admin/users/${id}/ban`, { banned: !banned }, banned ? "User unbanned" : "User banned")}
      >
        {banned ? "Unban" : "Ban"}
      </Button>
    </div>
  );
}
