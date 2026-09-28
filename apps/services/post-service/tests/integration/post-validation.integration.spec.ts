import { vi, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock('../../src/config/cassandra', () => ({
  getCassandraClient: vi.fn(() => ({ execute: mockExecute, shutdown: vi.fn() })),
}));

vi.mock('../../src/kafka/producer', () => ({
  producer: { connect: vi.fn(), disconnect: vi.fn(), send: vi.fn() },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));
vi.mock('../../src/config/r2', () => ({ r2Client: {} }));

import { buildServer } from '../helpers/fastify.test.helper';
import { redis } from '../../src/config/redis';
import { env } from '../../src/config/env';

const USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const POST_ID = 'b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

function cassandraPostRow() {
  return {
    post_id: POST_ID,
    user_id: USER_ID,
    image_urls: [`https://test.r2.dev/posts/${USER_ID}/a.jpg`],
    caption: 'legenda antiga',
    total_likes: 0,
    total_comments: 0,
    is_deleted: false,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: null,
  };
}
const AUTH = 'Bearer token-do-app';

function createBody() {
  return {
    userId: USER_ID,
    caption: 'Hoje tem festa',
    media: [{ url: `https://test.r2.dev/posts/${USER_ID}/a.jpg`, type: 'IMAGE' }],
  };
}

/**
 * Prova o caminho HTTP inteiro: o veredito do post-validation-service vira uma
 * resposta que o app consegue usar.
 *
 * O `fetch` global é mockado porque o serviço de validação não sobe nos testes
 * — o que se valida aqui é o contrato entre os dois, não a regra de conteúdo
 * (essa tem suíte própria no post-validation-service).
 */
describe('post-service — integração com post-validation-service', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    await redis.connect();
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({ rows: [] });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    (env as { post_validation_mode: string }).post_validation_mode = 'block';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    (env as { post_validation_mode: string }).post_validation_mode = 'block';
  });

  function postar(headers: Record<string, string> = { authorization: AUTH }) {
    return app.inject({
      method: 'POST',
      url: '/posts',
      headers,
      payload: createBody(),
    });
  }

  it('cria o post (201) quando a validação aprova', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ valid: true, issues: [] }),
    });

    const response = await postar();

    expect(response.statusCode).toBe(201);
  });

  /**
   * 422 e não 400: o payload está sintaticamente correto, o que foi recusado é
   * o conteúdo.
   *
   * O `message` carrega o motivo porque é o único campo que o app exibe
   * (`apiErrorMessage` lê `message` de qualquer 4xx). Um texto genérico ali
   * deixava o autor saber que foi recusado, mas não o que corrigir.
   */
  it('recusa com 422 e põe o motivo no message que o app exibe', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        valid: false,
        issues: [
          { code: 'FORBIDDEN_LANGUAGE', field: 'content', message: 'A publicação contém linguagem imprópria.' },
        ],
      }),
    });

    const response = await postar();

    expect(response.statusCode).toBe(422);

    const body = response.json();
    expect(body.message).toBe('A publicação contém linguagem imprópria.');
    expect(body.issues).toEqual([
      { code: 'FORBIDDEN_LANGUAGE', field: 'content', message: 'A publicação contém linguagem imprópria.' },
    ]);
  });

  it('junta todos os motivos no message, na ordem em que vieram', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        valid: false,
        issues: [
          { code: 'CONTENT_TOO_LONG', field: 'content', message: 'Texto longo demais.' },
          { code: 'SHORTENED_LINK', field: 'content', message: 'Links encurtados não são permitidos.' },
        ],
      }),
    });

    const response = await postar();

    expect(response.json().message).toBe('Texto longo demais. Links encurtados não são permitidos.');
  });

  it('cai numa mensagem genérica quando as issues vêm sem texto', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ valid: false, issues: [{ code: 'HATE_SPEECH', field: 'content' }] }),
    });

    const response = await postar();

    expect(response.statusCode).toBe(422);
    expect(response.json().message).toBe('Conteúdo recusado pelas diretrizes da comunidade.');
  });

  it('não grava nada no Cassandra quando recusa', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ valid: false, issues: [{ code: 'SPAM_SUSPECTED', field: 'content', message: 'spam' }] }),
    });

    await postar();

    expect(mockExecute).not.toHaveBeenCalled();
  });

  /**
   * A decisão central da integração. Um filtro fora do ar não pode impedir
   * ninguém de publicar — o worker do post-validation-service revalida depois.
   */
  it('publica normalmente quando o serviço de validação está fora do ar', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await postar();

    expect(response.statusCode).toBe(201);
  });

  it('publica normalmente quando o chamador não manda token', async () => {
    const response = await postar({});

    expect(response.statusCode).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no modo warn mede mas publica mesmo reprovado', async () => {
    (env as { post_validation_mode: string }).post_validation_mode = 'warn';
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ valid: false, issues: [{ code: 'HATE_SPEECH', field: 'content', message: 'x' }] }),
    });

    const response = await postar();

    expect(response.statusCode).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('no modo off nem consulta', async () => {
    (env as { post_validation_mode: string }).post_validation_mode = 'off';

    const response = await postar();

    expect(response.statusCode).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * O schema de resposta do PATCH declara 422 com `issues`. Este teste é o que
   * prova que o array atravessa a serialização do Fastify — um schema sem o
   * campo o descartaria em silêncio.
   */
  it('recusa a edição de legenda com 422 e mantém as issues no corpo', async () => {
    mockExecute.mockResolvedValue({ rows: [cassandraPostRow()] });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        valid: false,
        issues: [{ code: 'SHORTENED_LINK', field: 'content', message: 'Links encurtados não são permitidos.' }],
      }),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/posts/${POST_ID}`,
      headers: { authorization: AUTH },
      payload: { caption: 'veja https://bit.ly/x', userId: USER_ID },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      message: 'Links encurtados não são permitidos.',
      issues: [{ code: 'SHORTENED_LINK', field: 'content', message: 'Links encurtados não são permitidos.' }],
    });
  });
});
