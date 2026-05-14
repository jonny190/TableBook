import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

async function signOutAction() {
  "use server";
  await signOut({ redirect: false });
  redirect("/login");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  const unread = await prisma.notification.count({ where: { userId: session.user.id, read: false } });

  const navItems = [
    { href: "/dashboard", label: "Home" },
    { href: "/dashboard/book", label: "Book a desk" },
    { href: "/dashboard/floor-plan", label: "Floor plan" },
    { href: "/dashboard/my-bookings", label: "My bookings" },
    { href: "/dashboard/notifications", label: `Notifications${unread ? ` (${unread})` : ""}` },
  ];
  if (role === "ADMIN" || role === "REPORTER") navItems.push({ href: "/dashboard/reports", label: "Reports" });
  if (role === "ADMIN")
    navItems.push(
      { href: "/dashboard/admin/floors", label: "Admin: Floors" },
      { href: "/dashboard/admin/desks", label: "Admin: Desks" },
      { href: "/dashboard/admin/users", label: "Admin: Users" },
    );

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <Link href="/dashboard" className="text-brand-600 font-bold text-lg">TableBook</Link>
          <nav className="flex items-center gap-1 flex-wrap">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="px-3 py-1.5 text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{session.user.email}</span>
            <span className="badge-slate">{role}</span>
            <form action={signOutAction}>
              <button className="btn-secondary" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
