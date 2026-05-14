import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { ACCESSIBILITY_LABELS } from "@/lib/utils";

const registerSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
  needs: z.array(z.string()).default([]),
});

async function registerAction(formData: FormData) {
  "use server";
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    needs: formData.getAll("needs"),
  });
  if (!parsed.success) redirect("/register?error=invalid");

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) redirect("/register?error=exists");

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      needs: parsed.data.needs as any,
    },
  });
  await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
  redirect("/dashboard");
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-8">
      <form action={registerAction} className="card p-8 w-full max-w-xl space-y-4">
        <h1 className="text-2xl font-bold">Create your account</h1>
        {error === "exists" && <p className="text-sm text-red-600">An account with that email already exists.</p>}
        {error === "invalid" && <p className="text-sm text-red-600">Please fill in all fields. Password must be 8+ characters.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input className="input mt-1" name="name" required />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input className="input mt-1" type="email" name="email" required autoComplete="email" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input className="input mt-1" type="password" name="password" required minLength={8} autoComplete="new-password" />
        </label>
        <fieldset className="border border-slate-200 dark:border-slate-700 rounded-md p-3">
          <legend className="text-sm font-medium px-1">Accessibility needs (optional)</legend>
          <p className="text-xs text-slate-500 mb-2">We'll prioritise matching desks at booking time.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {Object.entries(ACCESSIBILITY_LABELS).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="needs" value={k} className="rounded border-slate-300" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="btn-primary w-full" type="submit">Create account</button>
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
          Have an account? <Link href="/login" className="text-brand-600 hover:underline">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
