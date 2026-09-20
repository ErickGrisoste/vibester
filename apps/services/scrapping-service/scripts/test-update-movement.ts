import "dotenv/config";
import { MovementService } from "../src/services/movement.service";
import { kafkaProducer } from "../src/kafka/producer";

async function main() {
  await kafkaProducer.connect();

  const movementService = new MovementService();

  await movementService.updateMovementLevelsFromSavedEstablishments();

  await kafkaProducer.disconnect();
}

main().catch((error) => {
  console.error("Erro no script de teste:", error);
  process.exit(1);
});