import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendEmailWithRetry } = vi.hoisted(() => ({
    mockSendEmailWithRetry: vi.fn(),
}));

vi.mock("../../services/email.service", () => ({
    sendEmailWithRetry: mockSendEmailWithRetry,
}));

describe("email.worker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it("processes an enqueued email by calling sendEmailWithRetry", async () => {
        mockSendEmailWithRetry.mockResolvedValue(undefined);
        const { enqueueEmail } = await import("../email.worker");

        enqueueEmail({ to: "user@example.com", subject: "Hi", message: "body" });
        await vi.waitFor(() => expect(mockSendEmailWithRetry).toHaveBeenCalledTimes(1));
    });

    it("respects MAX_CONCURRENT_WORKERS=5: a 6th email only starts after the 1st resolves", async () => {
        const resolvers: Array<() => void> = [];

        mockSendEmailWithRetry.mockImplementation(() => {
            return new Promise<void>((resolve) => {
                resolvers.push(resolve);
            });
        });

        const { enqueueEmail } = await import("../email.worker");

        for (let i = 0; i < 6; i++) {
            enqueueEmail({ to: `user${i}@example.com`, subject: "Hi", message: "body" });
        }

        await vi.waitFor(() => expect(mockSendEmailWithRetry).toHaveBeenCalledTimes(5));
        expect(mockSendEmailWithRetry).toHaveBeenCalledTimes(5);

        resolvers[0]();
        await vi.waitFor(() => expect(mockSendEmailWithRetry).toHaveBeenCalledTimes(6));
    });

    it("keeps processing the queue even when sendEmailWithRetry rejects (isolated error, does not block the worker)", async () => {
        mockSendEmailWithRetry
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce(undefined);

        const { enqueueEmail } = await import("../email.worker");

        enqueueEmail({ to: "fail@example.com", subject: "Hi", message: "body" });
        enqueueEmail({ to: "ok@example.com", subject: "Hi", message: "body" });

        await vi.waitFor(() => expect(mockSendEmailWithRetry).toHaveBeenCalledTimes(2));
    });

    it("processes the queue in FIFO order", async () => {
        const callOrder: string[] = [];
        mockSendEmailWithRetry.mockImplementation(async (notification: { to: string }) => {
            callOrder.push(notification.to);
        });

        const { enqueueEmail } = await import("../email.worker");

        enqueueEmail({ to: "first@example.com", subject: "Hi", message: "body" });
        enqueueEmail({ to: "second@example.com", subject: "Hi", message: "body" });
        enqueueEmail({ to: "third@example.com", subject: "Hi", message: "body" });

        await vi.waitFor(() => expect(mockSendEmailWithRetry).toHaveBeenCalledTimes(3));
        expect(callOrder).toEqual(["first@example.com", "second@example.com", "third@example.com"]);
    });
});
