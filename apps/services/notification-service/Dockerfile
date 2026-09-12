FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts || npm install --ignore-scripts

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./dist/generated
COPY --from=builder /app/templates ./templates
COPY prisma ./prisma
COPY prisma.config.ts ./

EXPOSE 3006

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/server.js"]
