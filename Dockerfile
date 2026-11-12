FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# prisma.config.ts requires DATABASE_URL before generate. Generate does not
# connect. This value exists only in the build stage.
ARG DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV DATABASE_URL=$DATABASE_URL
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

RUN chown -R node:node /app
USER node

EXPOSE 3000

# Migrate and seed before listening. A failure exits nonzero and the server
# does not start. exec makes Node the process that receives stop signals.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/prisma db seed && exec node dist/main.js"]
