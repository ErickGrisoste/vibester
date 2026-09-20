import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// Kafka é efeito colateral de saída — mockado, como em profile.real.spec.ts.
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn().mockResolvedValue({}) }));
vi.mock("../../src/kafka/producer", () => ({
  producer: { connect: vi.fn(), disconnect: vi.fn(), send: mockSend },
}));

import prismaClient from "../../src/prisma/index.js";
import { redis } from "../../src/config/redis.js";
import { UserDeletionService } from "../../src/services/userDeletion.service.js";
import { buildServer } from "../helpers/fastify.test.helper.js";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const THIRD = "33333333-3333-4333-8333-333333333333";
const POST = "44444444-4444-4444-8444-444444444444";

describe("user-service — bloqueio, denúncia e exclusão (Postgres + Redis reais)", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let auth: { authorization: string };

  const createProfile = (accountId: string) =>
    app.inject({ method: "POST", url: "/users/profile", payload: { accountId } });
  const follow = (followerId: string, followingId: string) =>
    app.inject({ method: "POST", url: "/users/profile/followers/increase", payload: { followerId, followingId } });

  beforeAll(async () => {
    await redis.connect();
    app = await buildServer();
    await app.ready();
    auth = { authorization: `Bearer ${app.jwt.sign({ userId: "auth-id", accountId: ME })}` };
  });

  afterAll(async () => {
    await app.close();
    await prismaClient.$disconnect();
    redis.disconnect();
  });

  beforeEach(async () => {
    await prismaClient.contentReport.deleteMany();
    await prismaClient.userBlock.deleteMany();
    await prismaClient.userFollow.deleteMany();
    await prismaClient.userProfile.deleteMany();
    await redis.flushall();
    mockSend.mockClear();
    for (const id of [ME, OTHER, THIRD]) await createProfile(id);
  });

  it("bloquear desfaz o follow nas duas direções, ajusta contadores e impede seguir de novo", async () => {
    expect((await follow(ME, OTHER)).statusCode).toBe(200);
    expect((await follow(OTHER, ME)).statusCode).toBe(200);

    const res = await app.inject({ method: "POST", url: "/users/blocks", payload: { blockedId: OTHER }, headers: auth });
    expect(res.statusCode).toBe(201);

    expect(await prismaClient.userBlock.count({ where: { blockerId: ME, blockedId: OTHER } })).toBe(1);
    expect(await prismaClient.userFollow.count()).toBe(0);
    const [me, other] = await Promise.all([
      prismaClient.userProfile.findUniqueOrThrow({ where: { userID: ME } }),
      prismaClient.userProfile.findUniqueOrThrow({ where: { userID: OTHER } }),
    ]);
    expect([me.followers, me.following, other.followers, other.following]).toEqual([0, 0, 0, 0]);

    // Bloquear de novo é idempotente (unique real no banco).
    expect((await app.inject({ method: "POST", url: "/users/blocks", payload: { blockedId: OTHER }, headers: auth })).statusCode).toBe(201);

    // Nenhum dos dois consegue seguir enquanto o bloqueio existir.
    expect((await follow(OTHER, ME)).statusCode).toBe(403);
    expect((await follow(ME, OTHER)).statusCode).toBe(403);
  });

  it("lista, informa situação e desbloqueia", async () => {
    await app.inject({ method: "POST", url: "/users/blocks", payload: { blockedId: OTHER }, headers: auth });

    const list = await app.inject({ method: "GET", url: "/users/blocks?limit=10", headers: auth });
    expect(list.statusCode).toBe(200);
    expect(list.json().data).toHaveLength(1);
    expect(list.json().data[0].accountId).toBe(OTHER);

    const status = await app.inject({ method: "GET", url: `/users/blocks/${OTHER}/status`, headers: auth });
    expect(status.json()).toEqual({ blocking: true, blockedBy: false });

    const unblock = await app.inject({ method: "DELETE", url: `/users/blocks/${OTHER}`, headers: auth });
    expect(unblock.statusCode).toBe(200);
    expect(await prismaClient.userBlock.count()).toBe(0);
    expect((await follow(ME, OTHER)).statusCode).toBe(200);
  });

  it("denúncia grava com enum real, não duplica e avisa a moderação uma vez", async () => {
    const payload = { targetType: "POST", targetId: POST, targetOwnerId: OTHER, reason: "HARASSMENT", details: " ofensivo " };

    const first = await app.inject({ method: "POST", url: "/users/reports", payload, headers: auth });
    expect(first.statusCode).toBe(201);
    expect(first.json().created).toBe(true);

    const second = await app.inject({ method: "POST", url: "/users/reports", payload, headers: auth });
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual({ id: first.json().id, created: false });

    const row = await prismaClient.contentReport.findUniqueOrThrow({ where: { id: first.json().id } });
    expect(row).toMatchObject({ reporterId: ME, targetType: "POST", targetOwnerId: OTHER, reason: "HARASSMENT", details: "ofensivo", status: "OPEN" });

    const reportedEvents = mockSend.mock.calls.filter(([record]) => record.topic === "content.reported");
    expect(reportedEvents).toHaveLength(1);
  });

  it("exclusão de conta limpa perfil, follows, bloqueios e denúncias e corrige contadores", async () => {
    await follow(ME, OTHER);
    await follow(THIRD, ME);
    await app.inject({ method: "POST", url: "/users/blocks", payload: { blockedId: THIRD }, headers: auth });
    await follow(OTHER, ME);
    await app.inject({
      method: "POST", url: "/users/reports", headers: auth,
      payload: { targetType: "USER", targetId: OTHER, reason: "SPAM" },
    });

    // THIRD tinha seguido ME, mas o bloqueio desfez; OTHER segue ME e ME segue OTHER.
    await new UserDeletionService().handleUserDeleted(ME);

    expect(await prismaClient.userProfile.findUnique({ where: { userID: ME } })).toBeNull();
    expect(await prismaClient.userFollow.count({ where: { OR: [{ followerId: ME }, { followingId: ME }] } })).toBe(0);
    expect(await prismaClient.userBlock.count()).toBe(0);
    expect(await prismaClient.contentReport.count()).toBe(0);

    const other = await prismaClient.userProfile.findUniqueOrThrow({ where: { userID: OTHER } });
    expect(other.followers).toBe(0);
    expect(other.following).toBe(0);

    // Idempotente: o Kafka pode reentregar.
    await expect(new UserDeletionService().handleUserDeleted(ME)).resolves.toBeUndefined();
  });
});
