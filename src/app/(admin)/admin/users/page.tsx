import { getCurrentUser } from "@/server/auth/session";
import { listUsers } from "@/server/services/admin-service";
import { UserActions } from "@/components/admin/user-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const me = await getCurrentUser();
  const users = await listUsers(me, q?.slice(0, 100));
  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>
      <form className="mt-3 flex max-w-md gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search users" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Role</th>
              <th className="p-3">Listings</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">
                  <span className="font-medium">{u.fullName}</span>
                  {u.isBanned && <span className="ml-2 rounded bg-red-100 px-1.5 text-xs text-red-900">banned</span>}
                  <br />
                  <span className="text-muted-foreground">{u.email}</span>
                </td>
                <td className="p-3 capitalize">{u.role}</td>
                <td className="p-3 tabular-nums">{u._count.listings}</td>
                <td className="p-3">{u.createdAt.toISOString().slice(0, 10)}</td>
                <td className="p-3">
                  {u.id !== me?.id && <UserActions id={u.id} role={u.role} banned={u.isBanned} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
