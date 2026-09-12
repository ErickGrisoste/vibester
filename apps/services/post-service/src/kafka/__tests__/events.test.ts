import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../producer", () => ({
  producer: { send: mockSend },
}));

import { publishEvent, POSTS_TOPIC } from "../events";

describe("publishEvent", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it("publica no tópico e key informados, com key/value como o driver do Kafka espera", async () => {
    await publishEvent("post.liked", "post-1", "post.liked", { postId: "post-1" });

    expect(mockSend).toHaveBeenCalledOnce();
    const record = mockSend.mock.calls[0][0];
    expect(record.topic).toBe("post.liked");
    expect(record.messages).toHaveLength(1);
    expect(record.messages[0].key).toBe("post-1");
  });

  it("monta o envelope com eventId, eventType, occurredAt e data", async () => {
    const data = { postId: "post-1", totalLikes: 4 };
    await publishEvent(POSTS_TOPIC, "post-1", "post.stats.updated", data);

    const record = mockSend.mock.calls[0][0];
    const payload = JSON.parse(record.messages[0].value);

    expect(payload.eventType).toBe("post.stats.updated");
    expect(payload.data).toEqual(data);
    expect(typeof payload.eventId).toBe("string");
    expect(payload.eventId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new Date(payload.occurredAt).toISOString()).toBe(payload.occurredAt);
  });

  it("gera um eventId diferente a cada chamada", async () => {
    await publishEvent("post.liked", "post-1", "post.liked", {});
    await publishEvent("post.liked", "post-1", "post.liked", {});

    const [first, second] = mockSend.mock.calls.map(
      (call) => JSON.parse(call[0].messages[0].value).eventId
    );
    expect(first).not.toBe(second);
  });
});
