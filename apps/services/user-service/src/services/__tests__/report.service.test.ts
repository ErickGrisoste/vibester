import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockFindUnique, mockDelete, mockSend } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockDelete: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock("../../prisma/index", () => ({
  default: { contentReport: { create: mockCreate, findUnique: mockFindUnique, delete: mockDelete } },
}));

vi.mock("../../kafka/producer", () => ({ producer: { send: mockSend } }));

import { ReportService, CONTENT_REPORTED_TOPIC } from "../report.service";
import { SafetyError } from "../safetyError";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const POST = "33333333-3333-4333-8333-333333333333";

describe("ReportService", () => {
  let service: ReportService;
  const createdAt = new Date("2026-09-14T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReportService();
    mockCreate.mockResolvedValue({ id: "rep-1", createdAt });
    mockSend.mockResolvedValue([]);
    mockDelete.mockResolvedValue({});
  });

  it("recusa denunciar o próprio perfil", async () => {
    await expect(service.create(ME, { targetType: "USER", targetId: ME, reason: "SPAM" }))
      .rejects.toBeInstanceOf(SafetyError);
  });

  it("recusa denunciar a própria publicação", async () => {
    await expect(service.create(ME, { targetType: "POST", targetId: POST, targetOwnerId: ME, reason: "SPAM" }))
      .rejects.toBeInstanceOf(SafetyError);
  });

  it("denúncia de perfil usa o próprio perfil como dono e avisa a moderação", async () => {
    const result = await service.create(ME, { targetType: "USER", targetId: OTHER, reason: "HARASSMENT", details: "  xingou  " });

    expect(result).toEqual({ id: "rep-1", created: true });
    expect(mockCreate).toHaveBeenCalledWith({
      data: { reporterId: ME, targetType: "USER", targetId: OTHER, targetOwnerId: OTHER, reason: "HARASSMENT", details: "xingou" },
      select: { id: true, createdAt: true },
    });

    const record = mockSend.mock.calls[0][0];
    expect(record.topic).toBe(CONTENT_REPORTED_TOPIC);
    expect(JSON.parse(record.messages[0].value)).toEqual({
      reportId: "rep-1",
      reporterId: ME,
      targetType: "USER",
      targetId: OTHER,
      targetOwnerId: OTHER,
      reason: "HARASSMENT",
      details: "xingou",
      createdAt: createdAt.toISOString(),
    });
  });

  it("denúncia de publicação guarda o autor e detalhe vazio vira null", async () => {
    await service.create(ME, { targetType: "POST", targetId: POST, targetOwnerId: OTHER, reason: "NUDITY", details: "   " });

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ targetOwnerId: OTHER, details: null }),
    }));
  });

  it("denunciar o mesmo alvo de novo não duplica nem reenvia email", async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    mockFindUnique.mockResolvedValue({ id: "rep-antiga" });

    const result = await service.create(ME, { targetType: "USER", targetId: OTHER, reason: "SPAM" });

    expect(result).toEqual({ id: "rep-antiga", created: false });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("desfaz a denúncia quando o evento não sai", async () => {
    mockSend.mockRejectedValue(new Error("kafka down"));

    await expect(service.create(ME, { targetType: "USER", targetId: OTHER, reason: "SPAM" })).rejects.toThrow("kafka down");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "rep-1" } });
  });
});
