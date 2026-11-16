import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="GharKhoj home">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <path d="M4 15 16 4l12 11v13H4z" className="fill-primary" />
        <circle cx="16" cy="18" r="4.5" fill="none" stroke="white" strokeWidth="2.5" />
        <path d="m19.2 21.2 3.3 3.3" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="text-lg">
        Ghar<span className="text-primary">Khoj</span>
      </span>
    </Link>
  );
}
