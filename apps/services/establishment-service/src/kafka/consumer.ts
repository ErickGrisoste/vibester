import { Consumer, EachMessagePayload } from "kafkajs";
import { z } from "zod";
import { kafka } from "./client";
import { EstablishmentService } from "../services/establishment.service";

const movementUpdatedSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("establishment.movement.updated"),
  occurredAt: z.string(),
  data: z.object({
    establishmentId: z.string().uuid(),
    level: z.enum(["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH", "UNAVAILABLE"]),
    source: z.enum(["SERPAPI", "ESTIMATED"]),
    category: z.string().optional(),
  }),
});

const imagesUpdatedSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("establishment.images.updated"),
  occurredAt: z.string(),
  data: z.object({
    establishmentId: z.string().uuid(),
    images: z.array(
      z.object({
        url: z.string().url(),
        position: z.number().int().nonnegative(),
      })
    ),
  }),
});

export class EstablishmentKafkaConsumer {
  private consumer: Consumer;

  constructor() {
    this.consumer = kafka.consumer({ groupId: "establishment-service-group" });
  }

  async start() {
    await this.connectWithRetry();

    await this.consumer.subscribe({ topic: "establishments", fromBeginning: false });

    await this.consumer.run({ eachMessage: (payload) => this.handleMessage(payload) });

    console.log("[Kafka] establishment-service consumer started");
  }

  async stop() {
    await this.consumer.disconnect();
  }

  private async handleMessage({ message }: EachMessagePayload) {
    const value = message.value?.toString();
    if (!value) return;

    let raw: unknown;
    try {
      raw = JSON.parse(value);
    } catch (error) {
      console.error("[Kafka] Erro ao fazer parse da mensagem:", error);
      return;
    }

    const eventType = (raw as { eventType?: string }).eventType;

    if (eventType === "establishment.movement.updated") {
      await this.handleMovementUpdated(raw);
    } else if (eventType === "establishment.images.updated") {
      await this.handleImagesUpdated(raw);
    }
  }

  private async handleMovementUpdated(raw: unknown) {
    try {
      const parsed = movementUpdatedSchema.safeParse(raw);
      if (!parsed.success) return;

      const { establishmentId, level, category } = parsed.data.data;
      await EstablishmentService.updateMovementLevel(establishmentId, level);

      if (category) {
        await EstablishmentService.updateCategory(establishmentId, category);
        console.log(`[Kafka] categoria atualizada: ${establishmentId} → ${category}`);
      }

      console.log(`[Kafka] nivelMovimento atualizado: ${establishmentId} → ${level}`);
    } catch (error) {
      console.error("[Kafka] Erro ao processar establishment.movement.updated:", error);
    }
  }

  private async handleImagesUpdated(raw: unknown) {
    try {
      const parsed = imagesUpdatedSchema.safeParse(raw);
      if (!parsed.success) return;

      const { establishmentId, images } = parsed.data.data;
      await EstablishmentService.replaceImages(establishmentId, images);

      console.log(`[Kafka] imagens atualizadas: ${establishmentId} → ${images.length} foto(s)`);
    } catch (error) {
      console.error("[Kafka] Erro ao processar establishment.images.updated:", error);
    }
  }

  private async connectWithRetry(maxAttempts = 10) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.consumer.connect();
        console.log("[Kafka] establishment-service consumer conectado");
        return;
      } catch {
        console.error(`[Kafka] Tentativa ${attempt}/${maxAttempts} falhou. Aguardando 5s...`);
        if (attempt === maxAttempts) throw new Error("Falha ao conectar ao Kafka");
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
}
