export const dynamic = "force-static";
export default function Offline() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center space-y-3 max-w-md">
        <h1 className="text-2xl font-bold">You're offline</h1>
        <p className="text-slate-600 dark:text-slate-400">
          TableBook needs a connection to book or update desks. Reconnect and try again.
        </p>
      </div>
    </main>
  );
}
