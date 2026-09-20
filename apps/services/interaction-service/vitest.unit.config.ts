import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["tests/setup/vitest.setup.ts"],
    reporters: ["verbose"],
  },
});
