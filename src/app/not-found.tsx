import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linen px-4 text-center">
      <p className="ar-mono text-ink-2">Error 404</p>
      <h1 className="t-h1">We can't find that page</h1>
      <Link href="/" className="btn-primary">Back to the store</Link>
    </div>
  );
}
