import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRegistrationEvent } from "../registration.handler";

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

describe("handleRegistrationEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRenderTemplate.mockResolvedValue("<html>welcome</html>");
    });

    it("renders welcome.html and calls enqueueEmail with the correct subject and recipient", async () => {
        await handleRegistrationEvent(JSON.stringify({ email: "user@example.com", name: "Maria" }));

        expect(mockRenderTemplate).toHaveBeenCalledWith("welcome.html", {
            name: "Maria",
            platformLink: "https://vibester.com.br",
        });
        expect(mockEnqueueEmail).toHaveBeenCalledWith({
            to: "user@example.com",
            subject: "Seja bem vindo ao Vibester!",
            message: "<html>welcome</html>",
        });
    });

    it("captures the error without throwing when the payload is invalid", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(handleRegistrationEvent("not-json")).resolves.toBeUndefined();

        expect(mockEnqueueEmail).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});
