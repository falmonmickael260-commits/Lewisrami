# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Le Président — image de production.
#
# Le serveur Next.js détient l'état des parties en mémoire et pousse les mises
# à jour aux joueurs par SSE : il doit tourner en UN SEUL processus persistant.
# Cette image est donc faite pour un hébergeur « conteneur » (Render, Fly.io,
# Railway, VPS), pas pour une plateforme serverless. Voir DEPLOY.md.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# La sortie « standalone » contient le serveur et ses dépendances ;
# les fichiers statiques doivent être copiés à côté.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
