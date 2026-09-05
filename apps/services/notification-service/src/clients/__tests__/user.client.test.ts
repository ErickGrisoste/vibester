import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UserClient } from "../user.client";

describe("UserClient.getProfile", () => {
    let client: UserClient;

    beforeEach(() => {
        client = new UserClient();
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns a mapped ActorSummary on success", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: async () => ({
                accountId: "user-1",
                name: "Maria",
                username: "maria123",
                avatarUrl: "https://cdn/avatar.jpg",
            }),
        });

        const result = await client.getProfile("user-1");

        expect(result).toEqual({
            accountId: "user-1",
            name: "Maria",
            username: "maria123",
            avatarUrl: "https://cdn/avatar.jpg",
        });
    });

    it("returns null when response.ok is false", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });

        const result = await client.getProfile("user-1");

        expect(result).toBeNull();
    });

    it("returns null on timeout/abort", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
            (_url: string, init: { signal: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    init.signal.addEventListener("abort", () => reject(new Error("aborted")));
                }),
        );

        const result = await client.getProfile("user-1");

        expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));

        const result = await client.getProfile("user-1");

        expect(result).toBeNull();
    });
});
