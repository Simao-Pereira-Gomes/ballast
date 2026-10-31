# Builds the Ballast app. `docker compose up` runs it next to Postgres.
FROM node:26-alpine AS build
RUN npm install -g pnpm@12.16.1
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @ballast/web build

# The Nitro output bundles its dependencies, so the runtime image needs only Node.
FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
