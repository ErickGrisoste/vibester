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
COPY --from=builder --chown=appuser:appgroup /app/migrations ./migrations
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json

USER appuser

EXPOSE 3007

# A mesma imagem serve aos dois modos (SERVICE_MODE=api | SERVICE_MODE=worker).
#
# O migrate roda SÓ no worker: é ele que possui a tabela, e a API não abre conexão
# com o Cassandra em nenhum momento. Rodar nos dois Deployments colocaria duas
# réplicas aplicando DDL ao mesmo tempo, o que gera desacordo de schema no
# Cassandra. Como efeito colateral bom, o Deployment da API não precisa das
# credenciais do Astra.
CMD ["sh", "-c", "if [ \"$SERVICE_MODE\" = \"worker\" ]; then node dist/scripts/migrate.js || exit 1; fi; exec node dist/src/server.js"]
