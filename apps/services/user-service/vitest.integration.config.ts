import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration-real/**/*.spec.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["verbose"],
    // Testes de integração reais rodam em sequência para evitar conflitos de dados:
    // todos os arquivos usam o mesmo Postgres/Redis e limpam as tabelas no
    // beforeEach. `poolOptions.forks.singleFork` não existe mais no Vitest 4 (é
    // ignorado sem aviso e os arquivos rodavam em paralelo); `fileParallelism`
    // é a opção que vale, a mesma dos outros serviços.
    pool: "forks",
    fileParallelism: false,
  },
});
