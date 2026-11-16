import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-primary text-sm font-semibold">404</p>
      <h1 className="mt-2 text-3xl font-bold">We couldn&apos;t find that page</h1>
      <p className="text-muted-foreground mt-2">The listing may have been rented or removed.</p>
      <Button asChild className="mt-6">
        <Link href="/rent">Browse rentals</Link>
      </Button>
    </div>
  );
}
