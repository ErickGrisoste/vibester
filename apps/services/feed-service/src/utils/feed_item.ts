import { types } from "cassandra-driver";
import { toMediaItems } from "./media";

/**
 * Uma linha de `feed_by_user` no formato da resposta HTTP.
 *
 * A UDT volta em snake_case do driver; o restante da linha já é snake_case por contrato
 * da rota, mas `media` é campo novo e sai camelCase para bater com o formato do
 * post-service. Existe em um lugar só para que o feed cronológico e o rankeado nunca
 * divergirem no formato do item.
 */
export function toFeedResponseItem(row: types.Row) {
    return {
        ...row,
        media: toMediaItems(row.media, row.image_urls) ?? null,
    };
}
