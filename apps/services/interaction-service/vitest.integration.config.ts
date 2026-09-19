import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Testes contra Cassandra REAL (docker-compose.test.yml), sem
    // tests/setup/vitest.setup.ts — aqui o env de verdade é necessário.
    include: ["tests/integration-real/**/*.spec.ts"],
    reporters: ["verbose"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Sequencial: os specs compartilham o mesmo keyspace, então paralelizar
    // criaria condição de corrida entre eles.
    pool: "forks",
    fileParallelism: false,
  },
});
