import prismaClient from "../prisma/index";
import { RegisterInputInterface } from "../types/register.types";
import { AppError } from "../errors/app-error";
import { EmailVerificationService } from "./email-verification.service";

const emailVerificationService = new EmailVerificationService();

export class RegisterService {
    async register(input: RegisterInputInterface): Promise<void> {
        const existing = await prismaClient.access.findFirst({
            where: {
                OR: [{ email: input.email }, { username: input.username }],
            },
            select: { id: true },
        });

        if (existing) {
            throw new AppError("Email ou username já está em uso", 409, "account_already_exists");
        }

        await emailVerificationService.initiate(input);
    }
}
