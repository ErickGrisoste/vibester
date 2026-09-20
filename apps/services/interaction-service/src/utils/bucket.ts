/**
 * Bucket de partição do Cassandra, no formato `YYYY-MM-DD` em UTC.
 *
 * Sem ele a partição de um usuário cresce para sempre: ~120 impressões por dia
 * viram ~44 mil linhas por ano num único slot, muito acima do que o Cassandra
 * atende bem. Com bucket de dia, cada partição fica na casa das centenas.
 *
 * É UTC de propósito — este bucket é detalhe de armazenamento, não "dia de
 * negócio". Num app de vida noturna a festa das 2h pertence à noite anterior;
 * qualquer agregação por "noite" (fase 1) precisa calcular isso separadamente e
 * NÃO reaproveitar este campo.
 */
export function toDayBucket(occurredAt: Date | string): string {
    const date = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);

    if (Number.isNaN(date.getTime())) {
        throw new Error(`Data inválida para bucket: ${String(occurredAt)}`);
    }

    return date.toISOString().slice(0, 10);
}
