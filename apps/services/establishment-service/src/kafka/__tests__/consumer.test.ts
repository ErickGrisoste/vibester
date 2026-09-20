import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EachMessagePayload } from "kafkajs";

const {
  mockConsumerInstance,
  mockConsumerFactory,
  mockUpdateMovementLevel,
  mockUpdateCategory,
  mockReplaceImages,
} = vi.hoisted(() => {
  const mockConsumerInstance = {
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockConsumerInstance,
    mockConsumerFactory: vi.fn(() => mockConsumerInstance),
    mockUpdateMovementLevel: vi.fn().mockResolvedValue(undefined),
    mockUpdateCategory: vi.fn().mockResolvedValue(undefined),
    mockReplaceImages: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../client", () => ({
  kafka: { consumer: mockConsumerFactory },
}));

vi.mock("../../services/establishment.service", () => ({
  EstablishmentService: {
    updateMovementLevel: mockUpdateMovementLevel,
    updateCategory: mockUpdateCategory,
    replaceImages: mockReplaceImages,
  },
}));

import { EstablishmentKafkaConsumer } from "../consumer";

function makePayload(value: unknown): EachMessagePayload {
  return {
    topic: "establishments",
    partition: 0,
    message: { value: Buffer.from(JSON.stringify(value)) } as EachMessagePayload["message"],
    heartbeat: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  } as unknown as EachMessagePayload;
}

/** Sobe o consumer mockado e captura o handler passado pra consumer.run(),
 * pra poder disparar mensagens diretamente nos testes sem um Kafka real. */
async function startAndCaptureHandler() {
  const consumer = new EstablishmentKafkaConsumer();
  await consumer.start();

  const eachMessage = mockConsumerInstance.run.mock.calls[0][0].eachMessage as (
    payload: EachMessagePayload
  ) => Promise<void>;

  return { consumer, eachMessage };
}

describe("EstablishmentKafkaConsumer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsumerInstance.connect.mockResolvedValue(undefined);
    mockConsumerInstance.subscribe.mockResolvedValue(undefined);
    mockConsumerInstance.run.mockResolvedValue(undefined);
  });

  it("subscribes to the establishments topic and starts consuming", async () => {
    await startAndCaptureHandler();

    expect(mockConsumerInstance.connect).toHaveBeenCalledTimes(1);
    expect(mockConsumerInstance.subscribe).toHaveBeenCalledWith({
      topic: "establishments",
      fromBeginning: false,
    });
    expect(mockConsumerInstance.run).toHaveBeenCalledTimes(1);
  });

  describe("establishment.movement.updated", () => {
    it("updates the movement level", async () => {
      const { eachMessage } = await startAndCaptureHandler();

      await eachMessage(
        makePayload({
          eventId: "550e8400-e29b-41d4-a716-446655440000",
          eventType: "establishment.movement.updated",
          occurredAt: new Date().toISOString(),
          data: { establishmentId: "550e8400-e29b-41d4-a716-446655440001", level: "HIGH", source: "SERPAPI" },
        })
      );

      expect(mockUpdateMovementLevel).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
        "HIGH"
      );
      expect(mockUpdateCategory).not.toHaveBeenCalled();
      expect(mockReplaceImages).not.toHaveBeenCalled();
    });

    it("also updates the category when present", async () => {
      const { eachMessage } = await startAndCaptureHandler();

      await eachMessage(
        makePayload({
          eventId: "550e8400-e29b-41d4-a716-446655440000",
          eventType: "establishment.movement.updated",
          occurredAt: new Date().toISOString(),
          data: {
            establishmentId: "550e8400-e29b-41d4-a716-446655440001",
            level: "LOW",
            source: "ESTIMATED",
            category: "bar",
          },
        })
      );

      expect(mockUpdateCategory).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440001", "bar");
    });

    it("ignores a payload that fails schema validation", async () => {
      const { eachMessage } = await startAndCaptureHandler();

      await eachMessage(
        makePayload({
          eventId: "not-a-uuid",
          eventType: "establishment.movement.updated",
          occurredAt: new Date().toISOString(),
          data: { establishmentId: "550e8400-e29b-41d4-a716-446655440001", level: "HIGH", source: "SERPAPI" },
        })
      );

      expect(mockUpdateMovementLevel).not.toHaveBeenCalled();
    });
  });

  describe("establishment.images.updated", () => {
    it("replaces the establishment's image gallery", async () => {
      const { eachMessage } = await startAndCaptureHandler();

      await eachMessage(
        makePayload({
          eventId: "550e8400-e29b-41d4-a716-446655440000",
          eventType: "establishment.images.updated",
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          data: {
            establishmentId: "550e8400-e29b-41d4-a716-446655440001",
            images: [
              { url: "https://img.test/a.jpg", position: 0 },
              { url: "https://img.test/b.jpg", position: 1 },
            ],
          },
        })
      );

      expect(mockReplaceImages).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440001", [
        { url: "https://img.test/a.jpg", position: 0 },
        { url: "https://img.test/b.jpg", position: 1 },
      ]);
      expect(mockUpdateMovementLevel).not.toHaveBeenCalled();
    });

    it("ignores a payload with an invalid image url", async () => {
      const { eachMessage } = await startAndCaptureHandler();

      await eachMessage(
        makePayload({
          eventId: "550e8400-e29b-41d4-a716-446655440000",
          eventType: "establishment.images.updated",
          occurredAt: new Date().toISOString(),
          data: {
            establishmentId: "550e8400-e29b-41d4-a716-446655440001",
            images: [{ url: "not-a-url", position: 0 }],
          },
        })
      );

      expect(mockReplaceImages).not.toHaveBeenCalled();
    });

    it("does not throw when the service call rejects", async () => {
      mockReplaceImages.mockRejectedValueOnce(new Error("db down"));
      const { eachMessage } = await startAndCaptureHandler();

      await expect(
        eachMessage(
          makePayload({
            eventId: "550e8400-e29b-41d4-a716-446655440000",
            eventType: "establishment.images.updated",
            occurredAt: new Date().toISOString(),
            data: {
              establishmentId: "550e8400-e29b-41d4-a716-446655440001",
              images: [{ url: "https://img.test/a.jpg", position: 0 }],
            },
          })
        )
      ).resolves.not.toThrow();
    });
  });

  it("ignores messages with an unknown eventType", async () => {
    const { eachMessage } = await startAndCaptureHandler();

    await eachMessage(
      makePayload({
        eventId: "550e8400-e29b-41d4-a716-446655440000",
        eventType: "some.other.event",
        occurredAt: new Date().toISOString(),
        data: {},
      })
    );

    expect(mockUpdateMovementLevel).not.toHaveBeenCalled();
    expect(mockReplaceImages).not.toHaveBeenCalled();
  });

  it("ignores a message with no value without throwing", async () => {
    const { eachMessage } = await startAndCaptureHandler();

    await expect(
      eachMessage({
        topic: "establishments",
        partition: 0,
        message: { value: null } as unknown as EachMessagePayload["message"],
        heartbeat: vi.fn(),
        pause: vi.fn(),
      } as unknown as EachMessagePayload)
    ).resolves.not.toThrow();

    expect(mockUpdateMovementLevel).not.toHaveBeenCalled();
    expect(mockReplaceImages).not.toHaveBeenCalled();
  });

  it("does not throw when the message value is not valid JSON", async () => {
    const { eachMessage } = await startAndCaptureHandler();

    await expect(
      eachMessage({
        topic: "establishments",
        partition: 0,
        message: { value: Buffer.from("not-json") } as EachMessagePayload["message"],
        heartbeat: vi.fn(),
        pause: vi.fn(),
      } as unknown as EachMessagePayload)
    ).resolves.not.toThrow();
  });

  it("stop() disconnects the consumer", async () => {
    const { consumer } = await startAndCaptureHandler();

    await consumer.stop();

    expect(mockConsumerInstance.disconnect).toHaveBeenCalledTimes(1);
  });
});
