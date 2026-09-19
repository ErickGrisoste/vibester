import 'package:mobile/models/media/post_media.dart';

enum FeedItemType { userPost, event, unknown }

class FeedItemModel {
  final String itemId;
  final FeedItemType itemType;
  final String userId;
  final DateTime createdAt;
  final DateTime updatedAt;

  final String? authorId;
  final String? authorUsername;
  final String? authorProfilePicture;
  final bool authorVerified;

  final String? establishmentId;
  final String? establishmentName;
  final String? establishmentLogo;
  final String? establishmentCategory;

  final String? eventId;
  final String? eventTitle;
  final String? eventBanner;
  final List<String> eventLineup;
  final DateTime? eventDate;
  final String? eventLocation;
  final String? eventOrganizerName;
  final String? eventOrganizerLogo;
  final int totalConfirmed;
  final bool isLiked;

  final String? title;
  final String? content;
  final List<String> imageUrls;

  /// Mídia do post na ordem do carrossel, foto e vídeo. Vem de `media`
  /// (camelCase mesmo neste payload snake_case — ver
  /// `post-service/docs/midias-no-post.md`); em post antigo, de `image_urls`.
  final List<PostMedia> media;
  final List<String> tags;
  final int totalLikes;
  final int totalComments;
  final bool isSponsored;
  final bool isDeleted;

  FeedItemModel({
    required this.itemId,
    required this.itemType,
    required this.userId,
    required this.createdAt,
    required this.updatedAt,
    this.isLiked = false,
    this.authorId,
    this.authorUsername,
    this.authorProfilePicture,
    this.authorVerified = false,
    this.establishmentId,
    this.establishmentName,
    this.establishmentLogo,
    this.establishmentCategory,
    this.eventId,
    this.eventTitle,
    this.eventBanner,
    this.eventLineup = const [],
    this.eventDate,
    this.eventLocation,
    this.eventOrganizerName,
    this.eventOrganizerLogo,
    this.totalConfirmed = 0,
    this.title,
    this.content,
    this.imageUrls = const [],
    this.media = const [],
    this.tags = const [],
    this.totalLikes = 0,
    this.totalComments = 0,
    this.isSponsored = false,
    this.isDeleted = false,
  });

  factory FeedItemModel.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic v) =>
        v != null ? DateTime.tryParse(v) ?? DateTime.now() : DateTime.now();
    DateTime? parseDateOrNull(dynamic v) =>
        v != null ? DateTime.tryParse(v) : null;

    return FeedItemModel(
      itemId: json['item_id'] ?? '',
      itemType: _parseItemType(json['item_type']),
      isLiked: json['is_liked'] ?? false,
      userId: json['user_id'] ?? '',
      createdAt: parseDate(json['created_at']),
      updatedAt: parseDate(json['updated_at']),
      authorId: json['author_id'],
      authorUsername: json['author_username'],
      authorProfilePicture: json['author_profile_picture'],
      authorVerified: json['author_verified'] ?? false,
      establishmentId: json['establishment_id'],
      establishmentName: json['establishment_name'],
      establishmentLogo: json['establishment_logo'],
      establishmentCategory: json['establishment_category'],
      eventId: json['event_id'],
      eventTitle: json['event_title'],
      eventBanner: json['event_banner'],
      eventLineup: json['event_lineup'] != null
          ? List<String>.from(json['event_lineup'])
          : [],
      eventDate: parseDateOrNull(json['event_date']),
      eventLocation: json['event_location'],
      eventOrganizerName: json['event_organizer_name'],
      eventOrganizerLogo: json['event_organizer_logo'],
      totalConfirmed: json['total_confirmed'] ?? 0,
      title: json['title'],
      content: json['content'],
      imageUrls: json['image_urls'] != null
          ? List<String>.from(json['image_urls'])
          : [],
      media: PostMedia.listFromJson(
        json['media'],
        legacyImageUrls: json['image_urls'],
      ),
      tags: json['tags'] != null ? List<String>.from(json['tags']) : [],
      totalLikes: json['total_likes'] ?? 0,
      totalComments: json['total_comments'] ?? 0,
      isSponsored: json['is_sponsored'] ?? false,
      isDeleted: json['is_deleted'] ?? false,
    );
  }

  static FeedItemType _parseItemType(String? value) {
    switch (value) {
      case 'USER_POST':
        return FeedItemType.userPost;
      case 'EVENT':
        return FeedItemType.event;
      default:
        return FeedItemType.unknown;
    }
  }
}
