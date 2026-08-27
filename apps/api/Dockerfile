# Build and run the API. The web app is static files and does not need this.
FROM node:22-alpine AS build
WORKDIR /app

# Copy only the manifests first, so a dependency install is cached across
# source-only changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @auralis/shared --workspace @auralis/api --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @auralis/shared \
 && npm run build --workspace @auralis/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace @auralis/shared --workspace @auralis/api --include-workspace-root \
 && npm cache clean --force

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
# Migrations are read at runtime; the server applies them on boot.
COPY apps/api/drizzle apps/api/drizzle

# Do not run as root.
USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
