import { api, URLS } from './client';

const BASE = URLS.ESTABLISHMENT_URL;

export interface OpeningHour {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface Establishment {
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
  openingHours?: OpeningHour[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedEstablishments {
  data: Establishment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const listEstablishments = (params?: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString() ? `?${q.toString()}` : '';
  return api.get<PaginatedEstablishments>(`${BASE}/establishments${qs}`);
};

export const getEstablishment = (id: string) =>
  api.get<Establishment>(`${BASE}/establishments/${id}`);
