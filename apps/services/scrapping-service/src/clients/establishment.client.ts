import { env } from "../config/env";
import { fetchWithTimeout } from "../utils/retry";

export interface EstablishmentResponse {
  id: string;
  googlePlaceId: string | null;
  name: string;
  latitude: number;
  longitude: number;
}

interface PaginatedEstablishmentsResponse {
  data: EstablishmentResponse[];
  pagination: { totalPages: number };
}

export class EstablishmentClient {
  private readonly baseUrl = env.establishmentServiceUrl;

  async listOpenEstablishments(): Promise<EstablishmentResponse[]> {
    if (!this.baseUrl) {
      throw new Error("ESTABLISHMENT_SERVICE_URL não configurada");
    }

    const response = await fetchWithTimeout(`${this.baseUrl}/establishments/open`);

    if (!response.ok) {
      throw new Error(`Erro ao buscar estabelecimentos: ${response.status}`);
    }

    return response.json();
  }

  /** Todos os estabelecimentos cadastrados (abertos ou não), paginando até
   * esgotar — usada por backfills manuais, diferente de
   * listOpenEstablishments (só os abertos agora, usada pelo job horário). */
  async listAllEstablishments(pageSize = 100): Promise<EstablishmentResponse[]> {
    if (!this.baseUrl) {
      throw new Error("ESTABLISHMENT_SERVICE_URL não configurada");
    }

    const all: EstablishmentResponse[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/establishments?page=${page}&limit=${pageSize}`
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar estabelecimentos: ${response.status}`);
      }

      const body: PaginatedEstablishmentsResponse = await response.json();
      all.push(...body.data);
      totalPages = body.pagination.totalPages;
      page += 1;
    } while (page <= totalPages);

    return all;
  }
}
