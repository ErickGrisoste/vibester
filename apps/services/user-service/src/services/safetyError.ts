/** Erro esperado de bloqueio/denúncia, com o status HTTP que o controller devolve. */
export class SafetyError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.name = "SafetyError";
    }
}

export function isPrismaError(error: unknown, code: string): boolean {
    return (error as { code?: string } | null)?.code === code;
}
