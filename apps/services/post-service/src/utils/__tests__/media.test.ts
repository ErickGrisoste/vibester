import { describe, it, expect } from "vitest";
import { toMediaItems, toMediaRows, toLegacyImageUrls } from "../media";
import { MediaType } from "../../types/post.types";

describe("toMediaItems", () => {
  it("mapeia a UDT preservando ordem e thumbnail", () => {
    const result = toMediaItems(
      [
        { url: "https://cdn/a.jpg", type: "IMAGE", thumbnail_url: null },
        { url: "https://cdn/b.mp4", type: "VIDEO", thumbnail_url: "https://cdn/b.jpg" },
      ],
      null
    );

    expect(result).toEqual([
      { url: "https://cdn/a.jpg", type: MediaType.IMAGE },
      { url: "https://cdn/b.mp4", type: MediaType.VIDEO, thumbnailUrl: "https://cdn/b.jpg" },
    ]);
  });

  it("deriva de image_urls quando o post é anterior à migração", () => {
    const result = toMediaItems(null, ["https://cdn/a.jpg", "https://cdn/b.jpg"]);

    expect(result).toEqual([
      { url: "https://cdn/a.jpg", type: MediaType.IMAGE },
      { url: "https://cdn/b.jpg", type: MediaType.IMAGE },
    ]);
  });

  it("prefere media quando as duas colunas estão preenchidas", () => {
    const result = toMediaItems(
      [{ url: "https://cdn/novo.mp4", type: "VIDEO", thumbnail_url: null }],
      ["https://cdn/antigo.jpg"]
    );

    expect(result).toEqual([{ url: "https://cdn/novo.mp4", type: MediaType.VIDEO }]);
  });

  it("trata tipo desconhecido como IMAGE em vez de propagar lixo", () => {
    const result = toMediaItems([{ url: "https://cdn/a", type: "GIF", thumbnail_url: null }], null);

    expect(result[0].type).toBe(MediaType.IMAGE);
  });

  it("devolve lista vazia quando não há mídia de nenhum formato", () => {
    expect(toMediaItems(null, null)).toEqual([]);
  });
});

describe("toMediaRows", () => {
  it("converte thumbnailUrl ausente em null para a UDT", () => {
    const result = toMediaRows([{ url: "https://cdn/a.jpg", type: MediaType.IMAGE }]);

    expect(result).toEqual([{ url: "https://cdn/a.jpg", type: "IMAGE", thumbnail_url: null }]);
  });
});

describe("toLegacyImageUrls", () => {
  it("mantém só as imagens, preservando a ordem original", () => {
    const result = toLegacyImageUrls([
      { url: "https://cdn/a.jpg", type: MediaType.IMAGE },
      { url: "https://cdn/b.mp4", type: MediaType.VIDEO },
      { url: "https://cdn/c.jpg", type: MediaType.IMAGE },
    ]);

    expect(result).toEqual(["https://cdn/a.jpg", "https://cdn/c.jpg"]);
  });

  it("devolve lista vazia para post só de vídeo", () => {
    expect(toLegacyImageUrls([{ url: "https://cdn/b.mp4", type: MediaType.VIDEO }])).toEqual([]);
  });
});
