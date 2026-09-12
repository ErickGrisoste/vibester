import { vi } from "vitest";

vi.mock("../../src/config/env", () => ({
    env: {
        port: 3006,
        jwtSecret: "test-secret",
        databaseUrl: "postgresql://user:pass@localhost:5432/test",
        kafkaBrokers: ["localhost:9092"],
        redisUrl: "redis://localhost:6379",
        allowedOrigins: ["http://localhost:3000"],
        smtpHost: "smtp.test.local",
        smtpPort: 587,
        smtpEmail: "",
        smtpPassword: "",
        smtpFromName: "Vibester Test",
        userServiceUrl: "http://localhost:3003",
        postServiceUrl: "http://localhost:3000",
        httpClientTimeoutMs: 2000,
        templatesDir: "",
    },
}));
