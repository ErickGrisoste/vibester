import "dotenv/config";
import { randomUUID } from "node:crypto";
import { EstablishmentClient } from "../src/clients/establishment.client";
import { SerpApiService } from "../src/services/serpapi.service";
import { kafkaProducer } from "../src/kafka/producer";
import { consoleLogger } from "../src/utils/logger";

const IMAGES_EVENT_VERSION = 1;

/**
 * Script manual de backfill — não é um job/cron. Lê todos os estabelecimentos
 * já cadastrados (abertos ou não) e busca fotos de "Ambiente" na SerpAPI para
 * quem tem googlePlaceId, publicando um evento Kafka por estabelecimento com
 * fotos encontradas. O establishment-service (consumer existente) persiste.
 * Idempotente: pode ser rodado de novo a qualquer momento (novo
 * estabelecimento cadastrado, fotos desatualizadas) sem duplicar dado, já
 * que o consumer substitui a galeria inteira a cada evento.
 */
async function main() {
  const establishmentClient = new EstablishmentClient();
  const serpApiService = new SerpApiService();

  await kafkaProducer.connect();

  const summary = { success: 0, skipped: 0, empty: 0, failure: 0 };

  try {
    const establishments = await establishmentClient.listAllEstablishments();
    consoleLogger.info(`[BACKFILL] Estabelecimentos encontrados: ${establishments.length}`);

    for (const establishment of establishments) {
      if (!establishment.googlePlaceId) {
        summary.skipped += 1;
        consoleLogger.info(`[SKIP] ${establishment.name} sem googlePlaceId`);
        continue;
      }

      try {
        const images = await serpApiService.getPlaceImages(establishment.googlePlaceId);

        if (images.length === 0) {
          summary.empty += 1;
          consoleLogger.info(`[SEM FOTOS] ${establishment.name}`);
          continue;
        }

        await kafkaProducer.send({
          topic: "establishments",
          messages: [
            {
              key: establishment.id,
              value: JSON.stringify({
                eventId: randomUUID(),
                eventType: "establishment.images.updated",
                eventVersion: IMAGES_EVENT_VERSION,
                occurredAt: new Date().toISOString(),
                data: {
                  establishmentId: establishment.id,
                  images: images.map((url, position) => ({ url, position })),
                },
              }),
            },
          ],
        });

        summary.success += 1;
        consoleLogger.info(`[OK] ${establishment.name}: ${images.length} foto(s)`);
      } catch (error) {
        summary.failure += 1;
        consoleLogger.error(`[ERRO] Falha ao buscar fotos de ${establishment.name}`, error);
      }
    }

    consoleLogger.info(
      `[BACKFILL] Finalizado. total=${establishments.length} sucesso=${summary.success} sem_fotos=${summary.empty} skip=${summary.skipped} falha=${summary.failure}`
    );
  } finally {
    await kafkaProducer.disconnect();
  }
}

main().catch((error) => {
  console.error("Erro no script de backfill de imagens:", error);
  process.exit(1);
});
