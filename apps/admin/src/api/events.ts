import { api, URLS } from './client';

const BASE = URLS.EVENT_URL;

export interface Event {
  id: string;
  name: string;
  photoUrl: string;
  category: string;
  organizer: string;
  location: string;
  informacoes?: string | null;
  startDate: string;
  endDate: string;
  ticketLink?: string | null;
  totalConfirmed: number;
  latitude: number;
  longitude: number;
  isFeatured: boolean;
  establishmentId: string;
}

export interface CreateEventPayload {
  name: string;
  photoUrl: string;
  category: string;
  organizer: string;
  location: string;
  informacoes?: string;
  startDate: string;
  endDate: string;
  ticketLink?: string;
  latitude: number;
  longitude: number;
  establishmentId: string;
}

export interface CheckIn {
  checkedIn: boolean;
}

export const listAllEvents = () =>
  api.get<Event[]>(`${BASE}/events`);

export const listEventsWeek = (date?: string) => {
  const q = date ? `?date=${date}` : '';
  return api.get<Event[]>(`${BASE}/events/week${q}`);
};

export const getEventDetails = (eventId: string) =>
  api.get<Event>(`${BASE}/events/${eventId}`);

export const getEventsByEstablishment = (establishmentId: string) =>
  api.get<Event[]>(`${BASE}/events/establishment/${establishmentId}`);

export const createEvent = (payload: CreateEventPayload) =>
  api.post<Event>(`${BASE}/events`, payload, true);

export const toggleFeatured = (eventId: string, isFeatured: boolean) =>
  api.patch<{ id: string; isFeatured: boolean }>(
    `${BASE}/events/${eventId}/featured`,
    { isFeatured },
    true,
  );

export const checkInEvent = (eventId: string, userId: string) =>
  api.post<CheckIn>(`${BASE}/events/${eventId}/checkin`, { userId });

export const checkOutEvent = (eventId: string, userId: string) =>
  api.delete<CheckIn>(`${BASE}/events/${eventId}/checkin`, { userId });

export const getUserCheckIns = (userId: string) =>
  api.get<(Event & { checkedInAt: string })[]>(`${BASE}/events/checkins/${userId}`);
