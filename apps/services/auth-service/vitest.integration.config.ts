import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration-real/**/*.spec.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["verbose"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // Arquivos em sequência: compartilham Postgres/Redis e limpam `accesses` no
    // beforeEach. `singleFork` já garante isso no Vitest 3, mas foi removido no
    // Vitest 4 — sem esta linha, uma atualização faria os arquivos rodarem em
    // paralelo sem aviso (como aconteceu no user-service).
    fileParallelism: false,
  },
});
