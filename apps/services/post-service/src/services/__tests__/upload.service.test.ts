import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/r2", () => ({ r2Client: {} }));

const { mockGetSignedUrl } = vi.hoisted(() => ({
  mockGetSignedUrl: vi.fn().mockResolvedValue(
    "https://signed.r2.dev/posts/user/uuid?X-Amz-Signature=test"
  ),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { UploadService } from "../upload.service";
import { MediaType } from "../../types/post.types";

const imageFiles = (n: number) =>
  Array.from({ length: n }, () => ({ type: MediaType.IMAGE, contentType: "image/jpeg" }));

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

describe("UploadService", () => {
  let service: UploadService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue(
      "https://signed.r2.dev/posts/user/uuid?X-Amz-Signature=test"
    );
    service = new UploadService();
  });

  describe("generatePresignedUrls", () => {
    it("deve retornar a quantidade correta de items", async () => {
      const result = await service.generatePresignedUrls(USER_ID, imageFiles(3));
      expect(result).toHaveLength(3);
    });

    it("cada item deve ter uploadUrl, key e publicUrl", async () => {
      const result = await service.generatePresignedUrls(USER_ID, imageFiles(1));
      const item = result[0];
      expect(item).toHaveProperty("uploadUrl");
      expect(item).toHaveProperty("key");
      expect(item).toHaveProperty("publicUrl");
    });

    it("a key deve seguir o padrão posts/{userId}/{uuid}.{ext}", async () => {
      const result = await service.generatePresignedUrls(USER_ID, imageFiles(2));
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const item of result) {
        expect(item.key).toMatch(new RegExp(`^posts/${USER_ID}/`));
        expect(item.key.endsWith(".jpg")).toBe(true);
        const uuid = item.key.split("/").pop()!.replace(".jpg", "");
        expect(uuid).toMatch(uuidPattern);
      }
    });

    it("deve gerar keys únicas para cada item", async () => {
      const result = await service.generatePresignedUrls(USER_ID, imageFiles(5));
      const keys = result.map((r) => r.key);
      expect(new Set(keys).size).toBe(5);
    });

    it("publicUrl deve ser composta por r2_public_url + key", async () => {
      const result = await service.generatePresignedUrls(USER_ID, imageFiles(1));
      const { key, publicUrl } = result[0];
      expect(publicUrl).toBe(`https://test.r2.dev/${key}`);
    });

    it("uploadUrl deve ser a URL retornada pelo getSignedUrl", async () => {
      const result = await service.generatePresignedUrls(USER_ID, imageFiles(1));
      expect(result[0].uploadUrl).toBe(
        "https://signed.r2.dev/posts/user/uuid?X-Amz-Signature=test"
      );
    });

    it("deve chamar getSignedUrl uma vez por imagem", async () => {
      await service.generatePresignedUrls(USER_ID, imageFiles(4));
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(4);
    });

    it("deve funcionar com count=1", async () => {
      const result = await service.generatePresignedUrls(USER_ID, imageFiles(1));
      expect(result).toHaveLength(1);
    });

    it("deve funcionar com o máximo de 10 arquivos", async () => {
      await service.generatePresignedUrls(USER_ID, imageFiles(10));
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(10);
    });
  });
});
