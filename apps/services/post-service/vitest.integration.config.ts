import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Aponta para os testes de integração REAIS (Cassandra + Redis reais, sem
    // tests/setup/vitest.setup.ts, que mocka src/config/env inteiro). Os testes
    // mockados antigos (tests/integration/**) continuam rodando via `npm test`
    // (vitest.config.ts), que não foi alterado.
    include: ["tests/integration-real/**/*.spec.ts"],
    reporters: ["verbose"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Execução sequencial: os testes reais compartilham o mesmo keyspace/dados,
    // então rodar em paralelo causaria condição de corrida entre specs.
    // (Vitest 4 removeu `poolOptions.forks.singleFork` — `fileParallelism: false`
    // é o equivalente atual: força um único worker executando os arquivos em série.)
    pool: "forks",
    fileParallelism: false,
  },
});
