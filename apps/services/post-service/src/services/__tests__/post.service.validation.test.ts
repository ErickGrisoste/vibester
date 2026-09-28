import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: { del: vi.fn().mockResolvedValue(1), flushall: vi.fn() },
}));
vi.mock("../../config/redis", () => ({
  redis: mockRedis,
  cacheAside: async <T>(_key: string, _ttl: number, fetchFn: () => Promise<T>): Promise<T> => fetchFn(),
}));
vi.mock("../../kafka/producer", () => ({
  producer: { send: vi.fn().mockResolvedValue(undefined) },
}));

import { PostService } from "../post.service";
import { PostRepository } from "../../repository/post.repository";
import { LikeRepository } from "../../repository/like.repository";
import { ValidationClient, type ValidationOutcome } from "../../clients/validation.client";
import { HttpError } from "../../errors/http.error";
import { env } from "../../config/env";
import { CreatePostInput, MediaType, Post } from "../../types/post.types";

const ISSUE = { code: "HATE_SPEECH", field: "content", message: "reprovado" };

function clientReturning(outcome: ValidationOutcome): ValidationClient {
  return { validatePost: vi.fn(async () => outcome) } as unknown as ValidationClient;
}

function createMockPostRepository() {
  return {
    createInAllViews: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    updateCaptionInAllViews: vi.fn().mockResolvedValue(undefined),
  } as unknown as PostRepository;
}

const likeRepo = { findLikedPostIds: vi.fn() } as unknown as LikeRepository;

function createInput(overrides: Partial<CreatePostInput> = {}): CreatePostInput {
  return {
    userId: "user-1",
    media: [{ url: "https://test.r2.dev/posts/user-1/a.jpg", type: MediaType.IMAGE }],
    caption: "Hoje tem festa",
    ...overrides,
  } as CreatePostInput;
}

function existingPost(): Post {
  return {
    postId: "post-1",
    userId: "user-1",
    media: [{ url: "https://test.r2.dev/posts/user-1/a.jpg", type: MediaType.IMAGE }],
    imageUrls: ["https://test.r2.dev/posts/user-1/a.jpg"],
    caption: "legenda antiga",
    totalLikes: 0,
    totalComments: 0,
    isDeleted: false,
    createdAt: new Date("2026-01-01"),
  } as Post;
}

describe("PostService + post-validation-service", () => {
  let repo: ReturnType<typeof createMockPostRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockPostRepository();
    (env as { post_validation_mode: string }).post_validation_mode = "block";
  });

  afterEach(() => {
    (env as { post_validation_mode: string }).post_validation_mode = "block";
  });

  describe("create", () => {
    it("cria normalmente quando o conteudo e aprovado", async () => {
      const service = new PostService(
        repo,
        likeRepo,
        clientReturning({ status: "checked", verdict: { valid: true, issues: [] } }),
      );

      const post = await service.create(createInput(), { authorization: "Bearer t" });

      expect(post.postId).toEqual(expect.any(String));
      expect(repo.createInAllViews).toHaveBeenCalledTimes(1);
    });

    it("recusa com 422 e devolve as issues quando reprovado", async () => {
      const service = new PostService(
        repo,
        likeRepo,
        clientReturning({ status: "checked", verdict: { valid: false, issues: [ISSUE] } }),
      );

      const error = await service.create(createInput(), { authorization: "Bearer t" })
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).statusCode).toBe(422);
      expect((error as HttpError).details).toEqual({ issues: [ISSUE] });
    });

    /**
     * O ponto da ordem: post recusado não pode deixar rastro. Se a validação
     * rodasse depois da escrita, um conteúdo reprovado já estaria no Cassandra
     * e já teria publicado `post.created` no Kafka.
     */
    it("nao escreve nada quando reprova", async () => {
      const service = new PostService(
        repo,
        likeRepo,
        clientReturning({ status: "checked", verdict: { valid: false, issues: [ISSUE] } }),
      );

      await service.create(createInput(), { authorization: "Bearer t" }).catch(() => undefined);

      expect(repo.createInAllViews).not.toHaveBeenCalled();
    });

    /**
     * A decisão central da integração: um filtro fora do ar não pode derrubar a
     * publicação. O worker do post-validation-service revalida depois.
     */
    it("deixa passar quando o servico de validacao esta indisponivel", async () => {
      const service = new PostService(
        repo,
        likeRepo,
        clientReturning({ status: "unavailable", reason: "timeout" }),
      );

      await expect(service.create(createInput(), { authorization: "Bearer t" }))
        .resolves.toBeTruthy();
      expect(repo.createInAllViews).toHaveBeenCalledTimes(1);
    });

    it("deixa passar quando nao ha token para consultar", async () => {
      const service = new PostService(
        repo,
        likeRepo,
        clientReturning({ status: "skipped", reason: "missing_authorization" }),
      );

      await expect(service.create(createInput())).resolves.toBeTruthy();
    });

    it("no modo warn mede mas nao barra", async () => {
      (env as { post_validation_mode: string }).post_validation_mode = "warn";

      const service = new PostService(
        repo,
        likeRepo,
        clientReturning({ status: "checked", verdict: { valid: false, issues: [ISSUE] } }),
      );

      await expect(service.create(createInput(), { authorization: "Bearer t" }))
        .resolves.toBeTruthy();
      expect(repo.createInAllViews).toHaveBeenCalledTimes(1);
    });

    it("manda legenda, tags e quantidade de midia para validar", async () => {
      const client = clientReturning({ status: "checked", verdict: { valid: true, issues: [] } });
      const service = new PostService(repo, likeRepo, client);

      await service.create(
        createInput({
          caption: "festa",
          tags: ["rock"],
          media: [
            { url: "https://test.r2.dev/posts/user-1/a.jpg", type: MediaType.IMAGE },
            { url: "https://test.r2.dev/posts/user-1/b.jpg", type: MediaType.IMAGE },
          ],
        }),
        { authorization: "Bearer t" },
      );

      expect(client.validatePost).toHaveBeenCalledWith({
        content: "festa",
        tags: ["rock"],
        mediaCount: 2,
        authorization: "Bearer t",
      });
    });
  });

  describe("updateCaption", () => {
    it("recusa com 422 quando a legenda nova e reprovada", async () => {
      repo.findById = vi.fn().mockResolvedValue(existingPost());

      const service = new PostService(
        repo,
        likeRepo,
        clientReturning({ status: "checked", verdict: { valid: false, issues: [ISSUE] } }),
      );

      const error = await service
        .updateCaption({ postId: "post-1", caption: "ruim" }, "user-1", { authorization: "Bearer t" })
        .catch((err: unknown) => err);

      expect((error as HttpError).statusCode).toBe(422);
      expect(repo.updateCaptionInAllViews).not.toHaveBeenCalled();
    });

    /**
     * A ordem importa: quem nem pode editar o post não deve descobrir nada
     * sobre o filtro de conteúdo, e validar antes gastaria uma chamada de rede
     * para devolver 403 no fim.
     */
    it("checa o dono antes de validar o conteudo", async () => {
      repo.findById = vi.fn().mockResolvedValue(existingPost());

      const client = clientReturning({
        status: "checked",
        verdict: { valid: false, issues: [ISSUE] },
      });
      const service = new PostService(repo, likeRepo, client);

      const error = await service
        .updateCaption({ postId: "post-1", caption: "x" }, "outro-usuario", { authorization: "Bearer t" })
        .catch((err: unknown) => err);

      expect((error as HttpError).statusCode).toBe(403);
      expect(client.validatePost).not.toHaveBeenCalled();
    });

    /**
     * A edição só troca a legenda. Sem informar a mídia já existente, apagar a
     * legenda de um post com foto seria lido como post vazio.
     */
    it("informa a midia ja existente para nao virar post vazio", async () => {
      repo.findById = vi.fn().mockResolvedValue(existingPost());

      const client = clientReturning({ status: "checked", verdict: { valid: true, issues: [] } });
      const service = new PostService(repo, likeRepo, client);

      await service.updateCaption({ postId: "post-1", caption: "" }, "user-1", {
        authorization: "Bearer t",
      });

      expect(client.validatePost).toHaveBeenCalledWith(
        expect.objectContaining({ content: "", mediaCount: 1, postId: "post-1" }),
      );
    });

    it("deixa passar quando o servico esta indisponivel", async () => {
      repo.findById = vi.fn().mockResolvedValue(existingPost());

      const service = new PostService(
        repo,
        likeRepo,
        clientReturning({ status: "unavailable", reason: "network" }),
      );

      await expect(
        service.updateCaption({ postId: "post-1", caption: "nova" }, "user-1", {
          authorization: "Bearer t",
        }),
      ).resolves.toBeTruthy();
      expect(repo.updateCaptionInAllViews).toHaveBeenCalledTimes(1);
    });
  });
});
