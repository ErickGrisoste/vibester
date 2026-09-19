import { describe, it, expect, vi, beforeEach } from "vitest";
import { handlePasswordResetEvent } from "../passwordReset.handler";

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

describe("handlePasswordResetEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRenderTemplate.mockResolvedValue("<html>reset</html>");
    });

    it("renderiza o template de código e enfileira o email", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        await handlePasswordResetEvent(JSON.stringify({ email: "user@example.com", name: "maria", code: "123456", expiresInMinutes: 10 }));

        expect(mockRenderTemplate).toHaveBeenCalledWith("password_reset_code.html", {
            name: "maria",
            code: "123456",
            expiresInMinutes: 10,
        });
        expect(mockEnqueueEmail).toHaveBeenCalledWith({
            to: "user@example.com",
            subject: "Seu código para redefinir a senha do Vibester",
            message: "<html>reset</html>",
        });
        // O código nunca vai para o log.
        expect(logSpy.mock.calls.flat().join(" ")).not.toContain("123456");
        logSpy.mockRestore();
    });

    it("ignora evento sem email ou código", async () => {
        await handlePasswordResetEvent(JSON.stringify({ email: "user@example.com" }));
        expect(mockEnqueueEmail).not.toHaveBeenCalled();
    });

    it("não lança com payload inválido", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(handlePasswordResetEvent("not-json")).resolves.toBeUndefined();
        expect(mockEnqueueEmail).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});
