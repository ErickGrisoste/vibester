import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/integration/**/*.spec.ts"],
    // tests/integration-real fala com um Cassandra de verdade e roda só via
    // vitest.integration.config.ts — nunca deve ser pego pelo `npm test` padrão,
    // que precisa rodar sem nenhuma infra.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/integration-real/**"],
    setupFiles: ["tests/setup/vitest.setup.ts"],
    reporters: ["verbose"],
  },
});
