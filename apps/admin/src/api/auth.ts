import { api, URLS } from './client';

const BASE = URLS.AUTH_URL;

export interface LoginPayload {
  email?: string;
  username?: string;
  password: string;
}

export interface LoginResponse {
  authId: string;
  token: string;
  accountId: string;
}

export interface RegisterPayload {
  username: string;
  name: string;
  email: string;
  password: string;
  bornAt: string;
}

export interface VerifyEmailPayload {
  email: string;
  code: string;
}

export interface VerifyEmailResponse {
  authId: string;
  accountId: string;
  username: string;
  name: string;
  email: string;
  bornAt: string;
  createdAt: string;
  updatedAt: string;
}

export const loginApi = (payload: LoginPayload) =>
  api.post<LoginResponse>(`${BASE}/login`, payload);

export const registerApi = (payload: RegisterPayload) =>
  api.post<{ message: string }>(`${BASE}/register`, payload);

export const verifyEmailApi = (payload: VerifyEmailPayload) =>
  api.post<VerifyEmailResponse>(`${BASE}/verify-email`, payload);
