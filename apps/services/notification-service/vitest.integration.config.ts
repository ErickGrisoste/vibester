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
    pool: "forks",
    fileParallelism: false,
  },
});
