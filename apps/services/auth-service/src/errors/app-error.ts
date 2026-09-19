/**
 * `reason` é um código estável, em inglês, para observabilidade — ele vai para
 * o log de auditoria e nunca para a resposta HTTP. A `message` continua sendo o
 * texto genérico que o cliente vê, então dois motivos diferentes podem (e no
 * caso do login, devem) compartilhar a mesma mensagem para não permitir
 * enumeração de usuários.
 */
export class AppError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly reason?: string,
    ) {
        super(message);
        this.name = 'AppError';
    }
}
