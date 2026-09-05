import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleVerificationEvent } from "../verification.handler";

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

describe("handleVerificationEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRenderTemplate.mockResolvedValue("<html>code</html>");
    });

    it("renders two_factor_code.html with name/code and calls enqueueEmail", async () => {
        await handleVerificationEvent(JSON.stringify({ email: "user@example.com", name: "Maria", code: "123456" }));

        expect(mockRenderTemplate).toHaveBeenCalledWith("two_factor_code.html", {
            name: "Maria",
            code: "123456",
        });
        expect(mockEnqueueEmail).toHaveBeenCalledWith({
            to: "user@example.com",
            subject: "Aqui está o seu código de verificação",
            message: "<html>code</html>",
        });
    });

    it("captures the error without throwing when the payload is invalid", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(handleVerificationEvent("not-json")).resolves.toBeUndefined();

        expect(mockEnqueueEmail).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});
