import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
    }
    throw e;
  }
  redirect(next);
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form action={loginAction} className="card p-8 w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Sign in</h1>
        {error && <p className="text-sm text-red-600">Invalid email or password.</p>}
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input className="input mt-1" type="email" name="email" required autoComplete="email" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input className="input mt-1" type="password" name="password" required autoComplete="current-password" />
        </label>
        <button className="btn-primary w-full" type="submit">Sign in</button>
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
          No account? <Link href="/register" className="text-brand-600 hover:underline">Create one</Link>
        </p>
      </form>
    </main>
  );
}
