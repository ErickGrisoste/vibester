import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUserDeletedMessage } from "../consumer";

const ACCOUNT = "5f0c1a1e-9d8b-4c1a-8e2f-1b2c3d4e5f60";

describe("handleUserDeletedMessage", () => {
  const service = { deleteAllContent: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("apaga o conteúdo da conta do evento do auth-service", async () => {
    await handleUserDeletedMessage(JSON.stringify({ userId: ACCOUNT, accountId: ACCOUNT, occurredAt: "x" }), service);
    expect(service.deleteAllContent).toHaveBeenCalledWith(ACCOUNT);
  });

  it("descarta evento malformado ou com id que não é UUID", async () => {
    await handleUserDeletedMessage("not-json", service);
    await handleUserDeletedMessage(JSON.stringify({}), service);
    await handleUserDeletedMessage(JSON.stringify({ accountId: "../outro-prefixo" }), service);

    expect(service.deleteAllContent).not.toHaveBeenCalled();
  });

  it("propaga erro do serviço para o Kafka reentregar", async () => {
    service.deleteAllContent.mockRejectedValueOnce(new Error("r2 down"));
    await expect(handleUserDeletedMessage(JSON.stringify({ accountId: ACCOUNT }), service)).rejects.toThrow("r2 down");
  });
});
