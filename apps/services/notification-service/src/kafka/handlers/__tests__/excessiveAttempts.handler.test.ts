import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleExcessiveAttemptsEvent } from "../excessiveAttempts.handler";

const { mockRenderTemplate, mockEnqueueEmail } = vi.hoisted(() => ({
    mockRenderTemplate: vi.fn(),
    mockEnqueueEmail: vi.fn(),
}));

vi.mock("../../../services/templateRenderer.service", () => ({
    renderTemplate: mockRenderTemplate,
}));

vi.mock("../../../workers/email.worker", () => ({
    enqueueEmail: mockEnqueueEmail,
}));

const baseEvent = {
    email: "user@example.com",
    name: "Maria",
    attempts: 5,
    windowSeconds: 900,
    occurredAt: "2026-09-07T20:00:00.000Z",
};

describe("handleExcessiveAttemptsEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRenderTemplate.mockResolvedValue("<html>alerta</html>");
    });

    it("renders excessive_login_attempts.html and queues the alert email", async () => {
        await handleExcessiveAttemptsEvent(JSON.stringify(baseEvent));

        expect(mockRenderTemplate).toHaveBeenCalledWith("excessive_login_attempts.html", {
            name: "Maria",
            attempts: 5,
            windowMinutes: 15,
        });
        expect(mockEnqueueEmail).toHaveBeenCalledWith({
            to: "user@example.com",
            subject: "Tentativas de acesso à sua conta Vibester",
            message: "<html>alerta</html>",
        });
    });

    it("rounds the window to at least one minute", async () => {
        await handleExcessiveAttemptsEvent(JSON.stringify({ ...baseEvent, windowSeconds: 20 }));

        expect(mockRenderTemplate).toHaveBeenCalledWith(
            "excessive_login_attempts.html",
            expect.objectContaining({ windowMinutes: 1 }),
        );
    });

    it("captures the error without throwing when the payload is invalid", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(handleExcessiveAttemptsEvent("not-json")).resolves.toBeUndefined();

        expect(mockEnqueueEmail).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});
