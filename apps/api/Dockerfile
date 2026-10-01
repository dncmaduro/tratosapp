ARG NODE_VERSION=22.23.2

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile \
    && pnpm --filter @tratosapp/api build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN pnpm install --prod --filter @tratosapp/api --frozen-lockfile

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=production-dependencies /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/scripts/seed-admin.js ./apps/api/scripts/seed-admin.js
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
