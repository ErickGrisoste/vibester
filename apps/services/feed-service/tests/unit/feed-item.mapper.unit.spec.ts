import { describe, it, expect } from "vitest";
import {
  toFeedItem,
  toEventItem,
  toPost,
  rowToPost,
  rowToEvent,
  postToFeedItem,
  eventToFeedItem,
  PostRow,
  EventRow,
} from "../../src/services/feed-item.mapper";
import { FeedItemType } from "../../src/types/feed.types";
import { MediaType } from "../../src/utils/media";

const ISO_DATE = "2024-01-15T12:00:00.000Z";

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    itemId: "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
    authorId: "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
    authorUsername: "testuser",
    authorProfilePicture: "https://example.com/pic.jpg",
    authorVerified: true,
    establishmentId: undefined,
    establishmentName: undefined,
    establishmentLogo: undefined,
    establishmentCategory: undefined,
    title: undefined,
    content: "Ótimo lugar!",
    imageUrls: ["https://example.com/img.jpg"],
    media: undefined,
    tags: ["bar", "noite"],
    totalLikes: 5,
    totalComments: 2,
    isLiked: false,
    isSponsored: false,
    isDeleted: false,
    createdAt: ISO_DATE,
    updatedAt: undefined,
    ...overrides,
  };
}

describe("feed-item.mapper — toFeedItem (por itemType)", () => {
  it("USER_POST: mapeia payload preservando isSponsored recebido", () => {
    const item = toFeedItem({ ...basePayload({ isSponsored: false }), itemType: FeedItemType.USER_POST } as any);
    expect(item.itemType).toBe(FeedItemType.USER_POST);
    expect(item.isSponsored).toBe(false);
    expect(item.tags).toEqual(["bar", "noite"]);
    expect(item.createdAt).toEqual(new Date(ISO_DATE));
  });

  it("ESTABLISHMENT_POST: mapeia payload preservando isSponsored recebido", () => {
    const item = toFeedItem({ ...basePayload({ isSponsored: false }), itemType: FeedItemType.ESTABLISHMENT_POST } as any);
    expect(item.itemType).toBe(FeedItemType.ESTABLISHMENT_POST);
    expect(item.isSponsored).toBe(false);
  });

  it("SPONSORED_POST: força isSponsored=true mesmo se o payload disser false", () => {
    const item = toFeedItem({ ...basePayload({ isSponsored: false }), itemType: FeedItemType.SPONSORED_POST } as any);
    expect(item.itemType).toBe(FeedItemType.SPONSORED_POST);
    expect(item.isSponsored).toBe(true);
  });

  function eventPayload(itemType: FeedItemType) {
    return {
      ...basePayload(),
      itemType,
      eventId: "d1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      eventTitle: "Noite de Samba",
      eventBanner: "https://example.com/banner.jpg",
      eventLineup: ["DJ A", "DJ B"],
      eventDate: ISO_DATE,
      eventLocation: "Rio de Janeiro",
      eventOrganizerName: "Estab Bar",
      eventOrganizerLogo: "https://example.com/logo.jpg",
      totalConfirmed: 3,
    };
  }

  it("EVENT: mapeia campos de evento (único itemType de evento — só estabelecimentos criam eventos)", () => {
    const item = toFeedItem(eventPayload(FeedItemType.EVENT) as any);
    expect(item.itemType).toBe(FeedItemType.EVENT);
    expect(item.eventTitle).toBe("Noite de Samba");
    expect(item.eventLineup).toEqual(["DJ A", "DJ B"]);
    expect(item.eventDate).toEqual(new Date(ISO_DATE));
    expect(item.eventOrganizerName).toBe("Estab Bar");
    expect(item.totalConfirmed).toBe(3);
  });

  it("lança erro para itemType desconhecido", () => {
    expect(() => toFeedItem({ ...basePayload(), itemType: "UNKNOWN" } as any)).toThrow(
      "Unsupported feed item type"
    );
  });
});

describe("feed-item.mapper — toEventItem / toPost", () => {
  it("toEventItem converte item de feed de evento em Event", () => {
    const feedItem = toFeedItem({
      ...basePayload(),
      itemType: FeedItemType.EVENT,
      eventId: "d1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      eventTitle: "Noite de Samba",
      eventBanner: "https://example.com/banner.jpg",
      eventDate: ISO_DATE,
      eventLocation: "Rio de Janeiro",
      eventOrganizerName: "Estab Bar",
      eventOrganizerLogo: "https://example.com/logo.jpg",
      totalConfirmed: 3,
    } as any);

    const event = toEventItem(feedItem);
    expect(event.eventId).toBe("d1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5");
    expect(event.title).toBe("Noite de Samba");
    expect(event.totalConfirmed).toBe(3);
  });

  it("toPost converte item de feed de post em Post", () => {
    const feedItem = toFeedItem({ ...basePayload(), itemType: FeedItemType.USER_POST } as any);
    const post = toPost(feedItem);
    expect(post.postId).toBe(feedItem.itemId);
    expect(post.userId).toBe(feedItem.authorId);
    expect(post.caption).toBe("Ótimo lugar!");
    expect(post.imageUrls).toEqual(["https://example.com/img.jpg"]);
  });
});

describe("feed-item.mapper — rowToPost / rowToEvent (fronteira Cassandra)", () => {
  function makePostRow(overrides: Partial<PostRow> = {}): PostRow {
    return {
      user_id: "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      created_at: new Date(ISO_DATE),
      post_id: "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      user_username: "testuser",
      user_profile_picture: "https://example.com/pic.jpg",
      user_verified: true,
      establishment_id: null,
      establishment_name: null,
      establishment_logo: null,
      establishment_category: null,
      image_urls: ["https://example.com/img.jpg"],
      media: null,
      caption: "Ótimo lugar!",
      tags: ["bar"],
      total_likes: 5,
      total_comments: 2,
      is_deleted: false,
      updated_at: null,
      ...overrides,
    };
  }

  function makeEventRow(overrides: Partial<EventRow> = {}): EventRow {
    return {
      event_id: "d1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      created_at: new Date(ISO_DATE),
      author_id: "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      author_username: "organizer",
      author_profile_picture: null,
      author_verified: false,
      establishment_id: null,
      establishment_name: null,
      establishment_logo: null,
      establishment_category: null,
      event_title: "Festival de Verão",
      event_banner: "https://example.com/banner.jpg",
      event_lineup: null,
      event_date: new Date(ISO_DATE),
      event_location: "São Paulo",
      event_organizer_name: "Promotora XYZ",
      event_organizer_logo: null,
      total_confirmed: 0,
      is_deleted: false,
      updated_at: null,
      ...overrides,
    };
  }

  it("rowToPost converte null de coluna opcional em undefined", () => {
    const post = rowToPost(makePostRow());
    expect(post.establishmentId).toBeUndefined();
    expect(post.caption).toBe("Ótimo lugar!");
    expect(post.totalLikes).toBe(5);
  });

  it("rowToPost deriva media de image_urls legado quando media é null", () => {
    const post = rowToPost(makePostRow({ media: null, image_urls: ["https://example.com/legacy.jpg"] }));
    expect(post.media).toEqual([{ url: "https://example.com/legacy.jpg", type: MediaType.IMAGE }]);
  });

  it("rowToEvent converte null de coluna opcional em undefined", () => {
    const event = rowToEvent(makeEventRow());
    expect(event.establishmentId).toBeUndefined();
    expect(event.authorProfilePicture).toBeUndefined();
    expect(event.title).toBe("Festival de Verão");
  });
});

describe("feed-item.mapper — postToFeedItem / eventToFeedItem", () => {
  it("postToFeedItem gera item de feed para um seguidor específico", () => {
    const post = rowToPost({
      user_id: "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      created_at: new Date(ISO_DATE),
      post_id: "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      user_username: "testuser",
      user_profile_picture: "https://example.com/pic.jpg",
      user_verified: true,
      establishment_id: null,
      establishment_name: null,
      establishment_logo: null,
      establishment_category: null,
      image_urls: [],
      media: null,
      caption: "oi",
      tags: null,
      total_likes: 0,
      total_comments: 0,
      is_deleted: false,
      updated_at: null,
    });

    const feedItem = postToFeedItem(post, "follower-id", FeedItemType.USER_POST);
    expect(feedItem.userId).toBe("follower-id");
    expect(feedItem.itemType).toBe(FeedItemType.USER_POST);
    expect(feedItem.isLiked).toBe(false);
    expect(feedItem.isSponsored).toBe(false);
  });

  it("eventToFeedItem sempre usa itemType EVENT, independente da origem", () => {
    const event = rowToEvent({
      event_id: "d1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      created_at: new Date(ISO_DATE),
      author_id: "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
      author_username: "organizer",
      author_profile_picture: null,
      author_verified: false,
      establishment_id: null,
      establishment_name: null,
      establishment_logo: null,
      establishment_category: null,
      event_title: "Festival",
      event_banner: "https://example.com/b.jpg",
      event_lineup: null,
      event_date: new Date(ISO_DATE),
      event_location: "SP",
      event_organizer_name: "Org",
      event_organizer_logo: null,
      total_confirmed: 0,
      is_deleted: false,
      updated_at: null,
    });

    const feedItem = eventToFeedItem(event, "follower-id");
    expect(feedItem.itemType).toBe(FeedItemType.EVENT);
    expect(feedItem.userId).toBe("follower-id");
    expect(feedItem.content).toBeUndefined();
  });
});
