import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { listReports } from "@/server/services/admin-service";
import { ReportActions } from "@/components/admin/report-actions";
import { REPORT_REASON_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const status = ((await searchParams).status ?? "open") as "open" | "resolved" | "dismissed";
  const items = await listReports(
    await getCurrentUser(),
    ["open", "resolved", "dismissed"].includes(status) ? status : "open",
  );
  return (
    <div>
      <h1 className="text-2xl font-bold">Reports</h1>
      <nav className="mt-3 flex gap-2 text-sm">
        {["open", "resolved", "dismissed"].map((s) => (
          <Link
            key={s}
            href={`/admin/reports?status=${s}`}
            className={`rounded-full border px-3 py-1 capitalize ${s === status ? "bg-primary text-primary-foreground" : ""}`}
          >
            {s}
          </Link>
        ))}
      </nav>
      {items.length === 0 && <p className="text-muted-foreground mt-8">No {status} reports.</p>}
      <ul className="mt-6 space-y-4">
        {items.map((r) => (
          <li key={r.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <Link href={`/listing/${r.listing.slug}`} target="_blank" className="font-medium hover:underline">
                {r.listing.title}
              </Link>
              <span className="text-muted-foreground text-xs">
                Listing status: {r.listing.status} · {r.listing.totalReports} report(s) total
              </span>
            </div>
            <p className="mt-1 text-sm">
              <strong>{REPORT_REASON_LABELS[r.reason]}</strong> — reported by {r.reporter}
            </p>
            {r.details && <p className="mt-1 text-sm italic">“{r.details}”</p>}
            {r.resolution && <p className="mt-1 text-sm">Resolution: {r.resolution}</p>}
            {r.status === "open" && <ReportActions id={r.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
