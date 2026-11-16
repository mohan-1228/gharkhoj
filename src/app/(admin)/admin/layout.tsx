import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/review", "Moderation queue"],
  ["/admin/reports", "Reports"],
  ["/admin/verifications", "Verifications"],
  ["/admin/users", "Users"],
  ["/admin/lookups", "Lookup data"],
  ["/admin/audit", "Audit log"],
] as const;

export const metadata = { robots: { index: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="hover:bg-muted rounded-md px-3 py-2 text-sm whitespace-nowrap">
            {label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
