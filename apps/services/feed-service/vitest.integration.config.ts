import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration-real/**/*.spec.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["verbose"],
    // Testes de integração reais rodam em sequência para evitar conflitos de dados
    // (TRUNCATE de tabelas compartilhadas entre specs no mesmo keyspace Cassandra).
    // Nota: `poolOptions.forks.singleFork` (usado como referência em outros serviços do
    // monorepo) foi removido no Vitest 4 — `fileParallelism: false` é o equivalente atual
    // para forçar execução sequencial dos arquivos de teste.
    pool: "forks",
    fileParallelism: false,
  },
});
