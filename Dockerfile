FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

FROM node:20-bookworm-slim AS builder
WORKDIR /app

ARG DATABASE_URL=file:./data/dev.db
ARG AUTH_SECRET=build-time-secret
ARG GEMINI_API_KEY=
ENV DATABASE_URL=${DATABASE_URL}
ENV AUTH_SECRET=${AUTH_SECRET}
ENV GEMINI_API_KEY=${GEMINI_API_KEY}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY package.json package-lock.json ./
COPY components.json ./
COPY next.config.ts ./
COPY postcss.config.mjs ./
COPY tailwind.config.ts ./
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY prisma.config.ts ./
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY package.json package-lock.json ./

RUN mkdir -p /app/data /app/templates /app/public/templates

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
