FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./

# --legacy-peer-deps contorna um bug do arborist (npm 10) ao resolver os peers
# opcionais do vitest. Não afeta as dependências de runtime.
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json

USER appuser

EXPOSE 3008

# A mesma imagem serve aos dois modos (SERVICE_MODE=api | SERVICE_MODE=worker).
#
# Sem migrate no CMD: este serviço não tem banco. A trilha de auditoria é log
# estruturado, e o cache é Redis — nenhum dos dois tem schema para versionar.
CMD ["node", "dist/src/server.js"]
