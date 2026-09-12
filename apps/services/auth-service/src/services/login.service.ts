import prismaClient from "../prisma";
import { LoginInputInterface, LoginOutputInterface } from "../types/register.types";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import { AuthAttemptsService } from "./auth-attempts.service";

// O cadastro grava o username com "@" na frente (ex.: "@joaosilva"), mas o
// usuario digita tanto "joaosilva" quanto "@joaosilva" na tela de login.
// Aceitamos as duas formas para nao depender da convencao usada na gravacao.
function usernameVariants(username: string): string[] {
    const trimmed = username.trim();
    const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;

    if (!withoutAt) return [];

    return [...new Set([trimmed, withoutAt, `@${withoutAt}`])];
}

export class LoginService {
    private readonly attempts = new AuthAttemptsService();

    async login(input: LoginInputInterface): Promise<LoginOutputInterface> {
        const usernames = input.username ? usernameVariants(input.username) : [];

        const user = await prismaClient.access.findFirst({
            where: {
                OR: [
                    ...(input.email ? [{ email: input.email.trim() }] : []),
                    ...(usernames.length ? [{ username: { in: usernames } }] : []),
                ],
            },
        });

        if (!user) {
            throw new AppError("Usuário ou senha inválidos", 401, "account_not_found");
        }

        const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);

        if (!passwordMatch) {
            // Conta existe e a senha errou: este é o unico caminho em que ha um
            // dono legitimo para avisar.
            await this.attempts.registerLoginFailure(user.email);
            throw new AppError("Usuário ou senha inválidos", 401, "invalid_password");
        }

        await this.attempts.clearLoginFailures(user.email);

        const token = jwt.sign(
            { userId: user.id, accountId: user.accountId },
            env.jwtSecret,
            { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] }
        );

        return {
            authId: user.id,
            token,
            accountId: user.accountId,
        };
    }
}
