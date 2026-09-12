import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/integration/**/*.spec.ts"],
    // tests/integration-real usa env real (Cassandra/Redis reais) e roda só via
    // vitest.integration.config.ts — nunca deve ser pego pelo `npm test` padrão.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/integration-real/**"],
    setupFiles: ["tests/setup/vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/services/**", "src/controller/**", "src/routes.ts"],
      reporter: ["text", "json-summary", "html"],
      thresholds: { lines: 70, functions: 70, branches: 60 },
    },
    reporters: ["verbose"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
