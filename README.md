# TableBook

A multi-storey desk-booking PWA with accessibility filters, floor-shutdown for power/heating savings, in-app notifications, role-based admin/reporter dashboards, and an interactive floor-plan view.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind 3
- PostgreSQL + Prisma 5
- NextAuth.js v5 (credentials) with JWT sessions
- PWA (manifest + service worker), installable on phones/desktops
- Server actions for mutations; thin REST endpoints for the floor-plan canvas
- Dockerfile + `docker-compose.yml` ready for Coolify

## Features

| Area | Capability |
|---|---|
| Booking | Pick a date, filter desks by required accessibility features, book and cancel. Day-level unique constraint stops double-booking. |
| Accessibility | Per-user accessibility profile, per-desk features, both surfaced at booking time and recorded for reports. |
| Floor shutdown | Admin can shut down or reopen a floor (HVAC zone label tracked); active bookings get a notification. Reports estimate kWh saved. |
| Floor plans | Admin uploads PNG/JPEG/WEBP/SVG per floor and clicks to place desks. Users see desks coloured by status and book by clicking. |
| Roles | `USER`, `REPORTER` (read-only reports), `ADMIN` (everything). Enforced at middleware *and* server-action level. |
| Notifications | In-app, with unread badge in the nav. Booking confirmations, cancellations, floor closure / reopening, admin broadcast. |
| PWA | Manifest, icons, service worker (network-first HTML, cache-first static, /offline page). |
| Reports | Occupancy (daily bookings + average rate), accessibility request vs supply (highlights gaps in red), live shutdown count, estimated energy savings. |

## Quick start (local dev)

```bash
cp .env.example .env       # tweak AUTH_SECRET for anything beyond local dev
docker compose up -d db    # Postgres on :5432
npm install
npx prisma migrate dev     # creates schema
npm run db:seed            # seeds 1 admin, 1 user, 1 reporter, a building w/ 3 floors and demo desks
npm run dev                # http://localhost:3000
```

Seed accounts (password `password123` for all):
- `admin@tablebook.local` — full admin
- `alex@tablebook.local` — regular user, has wheelchair + height-adjustable needs on profile
- `rachel@tablebook.local` — reporter (read-only reports)

## Deploying to Coolify

1. Push this repo to GitHub/Gitea.
2. In Coolify create a new resource → "Docker compose" (recommended) or use the included `Dockerfile` with a managed Postgres service.
3. Set the env vars on the app service:
   - `DATABASE_URL` — point to your Postgres
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `NEXTAUTH_URL` — public URL (e.g. `https://tablebook.example.com`)
   - `AUTH_TRUST_HOST=true`
4. The container's entrypoint runs `prisma migrate deploy` and seeds idempotently on first boot.
5. Make sure the volume mounted at `/app/public/uploads` is persistent (Coolify can mount a named volume) — that's where uploaded floor plans live. The included compose file already does this.

## Tests / smoke checks performed

- `npm run build` clean (only known bcryptjs edge-runtime warnings, suppressed by splitting auth.config off the middleware path)
- All public + dashboard routes return 200 for an admin session
- Non-admin user is 307-redirected from `/dashboard/admin/*` and `/dashboard/reports`
- Booking a desk via `POST /api/bookings` succeeds; second booking on the same desk+date returns 400 with the "already booked" message
- Desk-position API (admin only) returns 200 for admin, FORBIDDEN for a regular user
- `BOOKING_CONFIRMED` notification is created on booking
- PWA manifest + service worker served with correct content-type

## Project layout

```
prisma/
  schema.prisma         # Postgres schema, all entities + enums
  seed.ts               # idempotent seed
src/
  middleware.ts         # edge auth + RBAC redirects
  lib/
    auth.ts             # NextAuth (server) w/ Credentials + bcrypt
    auth.config.ts      # Edge-safe config (JWT callbacks, augmentations)
    db.ts               # Prisma client singleton
    booking.ts          # server actions: bookDesk, cancelBooking
    admin.ts            # server actions: buildings, floors, shutdowns, desks, users
    floorplan.ts        # server actions: uploadFloorPlan, setDeskPosition
    utils.ts            # date helpers + ACCESSIBILITY_LABELS
  app/
    page.tsx            # marketing landing
    login/, register/   # auth pages with server actions
    api/auth/[...nextauth]/route.ts  # NextAuth handler
    api/bookings/route.ts            # JSON booking endpoint (used by floor plan)
    api/desks/position/route.ts      # JSON desk-placement endpoint
    dashboard/
      layout.tsx        # role-aware nav, unread badge
      page.tsx          # home dashboard
      book/page.tsx     # list-view booking with filters
      floor-plan/...    # canvas + placement
      my-bookings/...
      notifications/...
      reports/page.tsx
      admin/
        floors/page.tsx # building/floor CRUD + shutdown / reopen
        desks/page.tsx  # desk CRUD + features + bookable toggle
        users/page.tsx  # role/active toggles + broadcast
public/
  manifest.webmanifest, sw.js, icons/, uploads/floorplans/
```

## Things deliberately scoped out for v1

- Multi-day / time-window bookings (currently full-day bookings, which matches typical hot-desk usage)
- Email or push notifications (in-app only — push would need VAPID keys + a worker on each device)
- Multi-tenant org separation (everything is one tenant)
- Bookings on behalf of others (admins can manage users, but the booking flow always books for the signed-in user)
- Real-time updates (page revalidation per server action; add socket.io / pusher if needed)

## Suggested next steps

- Replace the placeholder solid-blue PWA icons in `public/icons/` with real artwork
- Add a `prisma migrate diff` step to CI to catch un-migrated schema changes
- Wire push notifications via Web Push API + VAPID for floor-closure alerts on phones
- Persist floor plans to S3-compatible storage (replace `writeFile` in `lib/floorplan.ts`) once Coolify volume gets crowded
