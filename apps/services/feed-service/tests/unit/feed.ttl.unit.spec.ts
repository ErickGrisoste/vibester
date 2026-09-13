import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FeedTtlService, FEED_TTL } from "../../src/services/ttl_service";
import { FeedItemType } from "../../src/types/feed.types";

describe("FeedTtlService", () => {
  let service: FeedTtlService;

  beforeEach(() => {
    service = new FeedTtlService();
  });

  describe("getTtl", () => {
    it("retorna TTL de 7 dias para USER_POST", () => {
      const ttl = service.getTtl({ itemType: FeedItemType.USER_POST } as any);
      expect(ttl).toBe(FEED_TTL.USER_POST);
      expect(ttl).toBe(60 * 60 * 24 * 7);
    });

    it("retorna TTL de 15 dias para ESTABLISHMENT_POST", () => {
      const ttl = service.getTtl({ itemType: FeedItemType.ESTABLISHMENT_POST } as any);
      expect(ttl).toBe(FEED_TTL.ESTABLISHMENT_POST);
      expect(ttl).toBe(60 * 60 * 24 * 15);
    });

    it("retorna TTL de 15 dias para SPONSORED_POST", () => {
      const ttl = service.getTtl({ itemType: FeedItemType.SPONSORED_POST } as any);
      expect(ttl).toBe(FEED_TTL.ESTABLISHMENT_POST);
    });

    it("calcula TTL baseado na data do evento para EVENT", () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // +3 dias
      const ttl = service.getTtl({ itemType: FeedItemType.EVENT, eventDate: futureDate } as any);
      expect(ttl).toBeGreaterThan(0);
    });

    it("retorna 7 dias para tipos desconhecidos (fallback)", () => {
      const ttl = service.getTtl({ itemType: "UNKNOWN_TYPE" } as any);
      expect(ttl).toBe(60 * 60 * 24 * 7);
    });
  });

  describe("calculateEventTTL", () => {
    it("retorna TTL positivo para evento futuro (evento amanhã + 2 dias de graça)", () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const ttl = service.calculateEventTTL(tomorrow);
      expect(ttl).toBeGreaterThan(0);
    });

    it("retorna 0 para evento cuja janela de 2 dias pós-evento já expirou", () => {
      const longPast = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // -10 dias
      const ttl = service.calculateEventTTL(longPast);
      expect(ttl).toBe(0);
    });

    it("o TTL de evento amanhã é maior que o de evento hoje", () => {
      const today = new Date();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const ttlToday = service.calculateEventTTL(today);
      const ttlTomorrow = service.calculateEventTTL(tomorrow);
      expect(ttlTomorrow).toBeGreaterThan(ttlToday);
    });
  });
});
