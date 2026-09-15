import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("../../../config/env", () => ({
    env: { moderationEmail: "moderacao@example.com" },
}));

import { handleContentReportedEvent } from "../contentReported.handler";

const baseEvent = {
    reportId: "rep-1",
    reporterId: "acc-reporter",
    targetType: "POST",
    targetId: "post-1",
    targetOwnerId: "acc-author",
    reason: "HARASSMENT",
    details: "ofendeu nos comentários",
    createdAt: "2026-09-14T12:00:00.000Z",
};

describe("handleContentReportedEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRenderTemplate.mockResolvedValue("<html>report</html>");
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("envia a denúncia de post para a caixa da moderação", async () => {
        await handleContentReportedEvent(JSON.stringify(baseEvent));

        expect(mockRenderTemplate).toHaveBeenCalledWith("content_report.html", expect.objectContaining({
            reportId: "rep-1",
            targetLabel: "Publicação",
            isPost: true,
            reason: "Assédio ou bullying",
            targetOwnerId: "acc-author",
            details: "ofendeu nos comentários",
        }));
        expect(mockEnqueueEmail).toHaveBeenCalledWith({
            to: "moderacao@example.com",
            subject: "[Denúncia] Publicação — Assédio ou bullying",
            message: "<html>report</html>",
        });
    });

    it("rotula denúncia de perfil", async () => {
        await handleContentReportedEvent(JSON.stringify({ ...baseEvent, targetType: "USER", targetId: "acc-x", reason: "SPAM" }));

        expect(mockEnqueueEmail).toHaveBeenCalledWith(expect.objectContaining({
            subject: "[Denúncia] Perfil — Spam ou golpe",
        }));
    });

    it("não lança com payload inválido", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(handleContentReportedEvent("{")).resolves.toBeUndefined();
        expect(mockEnqueueEmail).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});
