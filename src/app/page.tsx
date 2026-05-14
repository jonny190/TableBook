import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 text-brand-600 font-bold text-2xl">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M3 4h18v3H3zM4 9h16l-1 11H5z"/></svg>
          TableBook
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Desk booking, made accessible.</h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          Book a desk in seconds — filter by accessibility needs, view floor plans, and let admins shut down empty
          floors to save power and heating.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/login" className="btn-primary">Sign in</Link>
          <Link href="/register" className="btn-secondary">Create account</Link>
        </div>
        <p className="text-xs text-slate-500">Installable as a PWA on phone &amp; desktop.</p>
      </div>
    </main>
  );
}
