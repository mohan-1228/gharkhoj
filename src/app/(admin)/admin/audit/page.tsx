import { getCurrentUser } from "@/server/auth/session";
import { auditLog } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const rows = await auditLog(await getCurrentUser(), 200);
  return (
    <div>
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="text-muted-foreground text-sm">
        Append-only record of moderation, admin and account actions (latest 200).
      </p>
      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">When (NPT)</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-3 whitespace-nowrap">
                  {r.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Kathmandu" })}
                </td>
                <td className="p-3">{r.actor?.fullName ?? "system"}</td>
                <td className="p-3 font-mono text-xs">{r.action}</td>
                <td className="p-3 font-mono text-xs">
                  {r.entity}:{r.entityId.slice(0, 8)}
                </td>
                <td className="p-3 font-mono text-xs break-all">{r.metadata ? JSON.stringify(r.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
