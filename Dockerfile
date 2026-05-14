# Multi-stage build for Next.js standalone + Prisma
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
# Coolify may pass NODE_ENV=production as a build arg, which by default makes
# `npm install` skip devDependencies. We need devDeps (typescript, tailwind,
# postcss, tsx) to build, so force include them and run in development mode
# for the dependency-install step only.
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --include=dev --no-audit --no-fund

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
# Same reason — keep devDeps available during the build.
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# Precompile the seed to JS so the slim runtime image doesn't need tsx
RUN npx tsc prisma/seed.ts --outDir prisma --target es2022 --module commonjs --esModuleInterop --skipLibCheck --resolveJsonModule || true

FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/prisma ./prisma
COPY --from=builder --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=app:app /app/node_modules/@prisma ./node_modules/@prisma
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/public/uploads/floorplans && chown -R app:app /app/public/uploads
USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
