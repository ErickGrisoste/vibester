import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSendMail = vi.fn();

vi.mock("nodemailer", () => ({
    default: {
        createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
    },
}));

async function loadEmailService(envOverrides: Record<string, unknown> = {}) {
    vi.resetModules();
    vi.doMock("../../config/env", () => ({
        env: {
            smtpHost: "smtp.test.local",
            smtpPort: 587,
            smtpEmail: "",
            smtpPassword: "",
            smtpFromName: "Vibester Test",
            ...envOverrides,
        },
    }));
    return import("../email.service");
}

describe("sendEmail — without SMTP credentials (dev mode)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not call transporter.sendMail, only logs and resolves", async () => {
        const { sendEmail } = await loadEmailService({ smtpEmail: "", smtpPassword: "" });

        await sendEmail({ to: "user@example.com", subject: "Hi", message: "body" });

        expect(mockSendMail).not.toHaveBeenCalled();
    });
});

describe("sendEmail — with SMTP credentials configured", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls transporter.sendMail with the correct from/to/subject/html", async () => {
        mockSendMail.mockResolvedValue(undefined);
        const { sendEmail } = await loadEmailService({ smtpEmail: "noreply@vibester.com.br", smtpPassword: "secret" });

        await sendEmail({ to: "user@example.com", subject: "Hi", message: "<p>body</p>" });

        expect(mockSendMail).toHaveBeenCalledWith({
            from: '"Vibester Test" <noreply@vibester.com.br>',
            to: "user@example.com",
            subject: "Hi",
            html: "<p>body</p>",
        });
    });

    it("propagates the error when sendMail rejects", async () => {
        mockSendMail.mockRejectedValue(new Error("SMTP down"));
        const { sendEmail } = await loadEmailService({ smtpEmail: "noreply@vibester.com.br", smtpPassword: "secret" });

        await expect(sendEmail({ to: "user@example.com", subject: "Hi", message: "body" })).rejects.toThrow("SMTP down");
    });
});

describe("sendEmailWithRetry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("calls sendEmail once and returns when successful on the 1st attempt", async () => {
        mockSendMail.mockResolvedValue(undefined);
        const { sendEmailWithRetry } = await loadEmailService({ smtpEmail: "noreply@vibester.com.br", smtpPassword: "secret" });

        const promise = sendEmailWithRetry({ to: "user@example.com", subject: "Hi", message: "body" });
        await vi.runAllTimersAsync();
        await promise;

        expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it("retries up to maxRetries with a wait between attempts, and gives up without throwing", async () => {
        mockSendMail.mockRejectedValue(new Error("SMTP down"));
        const { sendEmailWithRetry } = await loadEmailService({ smtpEmail: "noreply@vibester.com.br", smtpPassword: "secret" });

        const promise = sendEmailWithRetry({ to: "user@example.com", subject: "Hi", message: "body" }, 3);
        await vi.runAllTimersAsync();
        await expect(promise).resolves.toBeUndefined();

        expect(mockSendMail).toHaveBeenCalledTimes(3);
    });

    it("in dev mode (no transporter), ignores maxRetries and calls sendEmail a single time", async () => {
        const { sendEmailWithRetry } = await loadEmailService({ smtpEmail: "", smtpPassword: "" });

        const promise = sendEmailWithRetry({ to: "user@example.com", subject: "Hi", message: "body" }, 3);
        await vi.runAllTimersAsync();
        await promise;

        expect(mockSendMail).not.toHaveBeenCalled();
    });
});
