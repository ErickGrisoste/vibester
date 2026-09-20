export interface EstablishmentInterface {
  id: string;
  googlePlaceId?: string | null;
  name: string;
  bio?: string | null;
  endereco?: string | null;
  photoUrl?: string | null;
  bannerUrl?: string | null;
  category: string;
  priceIndicator?: string | null;
  averageRating: number;
  qtdAvaliacoes: number;
  distribuicao: number[];
  nivelMovimento: number;
  latitude: number;
  longitude: number;
  movementLevel?: MovementLevelResponse | null;
  distanceTo?: number;
}

export type SortBy = "name" | "rating" | "distance";

export interface ListEstablishmentsQuerystring {
  latitude?: string;
  longitude?: string;
  category?: string;
  minRating?: string;
  search?: string;
  sortBy?: SortBy;
  page?: string;
  limit?: string;
}

export interface GetEstablishmentParams {
  id: string;
}

export interface EstablishmentProfileResponse extends EstablishmentInterface {
  openingHours: OpeningHour[];
  images: EstablishmentImageResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EstablishmentImageResponse {
  id: string;
  url: string;
  source: "SERPAPI" | "MANUAL";
  position: number;
}

export interface ReplaceEstablishmentImagesInput {
  url: string;
  position: number;
  source?: "SERPAPI" | "MANUAL";
}

export interface MovementLevelResponse {
  level: string;
  source: string;
  updatedAt: Date;
}

export interface UpdateMovementLevelParams {
  id: string;
}

export interface UpdateMovementLevelBody {
  level: "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | "UNAVAILABLE";
  source: "SERPAPI" | "GOOGLE_MAPS" | "MANUAL" | "ESTIMATED";
}

export interface OpeningHour {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface ListEstablishmentsFilters {
  userLat?: number;
  userLon?: number;
  category?: string;
  minRating?: number;
  search?: string;
  sortBy?: SortBy;
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ListEstablishmentsInput {
  latitude: number;
  longitude: number;
  radiusKm?: number;
}
