import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DevLoginPanel } from "@/components/auth/dev-login-panel";
import { getCurrentUser } from "@/server/auth/session";
import { env } from "@/server/lib/env";
import { prisma } from "@/server/lib/db";
import { safeReturnTo } from "@/server/services/auth-service";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  expired: "Your sign-in session expired. Please try again.",
  state: "We couldn't verify that sign-in request. Please try again.",
  nonce: "We couldn't verify that sign-in request. Please try again.",
  signin: "Sign-in failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string; role?: string }>;
}) {
  const sp = await searchParams;
  const returnTo = safeReturnTo(sp.returnTo);
  if (await getCurrentUser()) redirect(returnTo);
  const enc = encodeURIComponent(returnTo);

  const demoUsers =
    env.AUTH_MODE === "dev"
      ? await prisma.user.findMany({
          where: { email: { endsWith: "@gharkhoj.local" } },
          select: { email: true, fullName: true, role: true },
          orderBy: { role: "asc" },
        })
      : [];

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Sign in to GharKhoj</h1>
      <p className="text-muted-foreground mt-1 text-sm">Save favourites, request tours and manage your listings.</p>
      {sp.error && (
        <p role="alert" className="border-destructive/40 bg-destructive/5 mt-4 rounded-md border p-3 text-sm">
          {ERRORS[sp.error] ?? "Sign-in failed."}
        </p>
      )}

      {env.AUTH_MODE === "cognito" ? (
        <div className="mt-8 space-y-3">
          <Button asChild className="w-full" size="lg">
            <a href={`/api/v1/auth/login?returnTo=${enc}`}>Sign in with email</a>
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline">
              <a href={`/api/v1/auth/login?signup=1&role=renter&returnTo=${enc}`}>Create renter account</a>
            </Button>
            <Button asChild variant="outline">
              <a
                href={`/api/v1/auth/login?signup=1&role=landlord&returnTo=${encodeURIComponent(returnTo === "/" ? "/landlord" : returnTo)}`}
              >
                I&apos;m a landlord
              </a>
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Secure sign-in is provided by Amazon Cognito. By continuing you agree to our{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      ) : (
        <DevLoginPanel returnTo={returnTo} demoUsers={demoUsers} />
      )}
    </div>
  );
}
