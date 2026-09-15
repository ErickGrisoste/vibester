import prismaClient from "../prisma/index";
import { RegisterInputInterface } from "../types/register.types";
import { AppError } from "../errors/app-error";
import { EmailVerificationService } from "./email-verification.service";

const emailVerificationService = new EmailVerificationService();

/** O Vibester é para maiores de idade (vida noturna, bares, UGC). */
export const MIN_AGE_YEARS = 18;

/** `true` quando quem nasceu em `bornAt` já completou `years` anos em `now` (UTC). */
export function hasMinimumAge(bornAt: Date, years = MIN_AGE_YEARS, now = new Date()): boolean {
    if (Number.isNaN(bornAt.getTime())) return false;

    const limit = Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate());
    return bornAt.getTime() <= limit;
}

export class RegisterService {
    async register(input: RegisterInputInterface): Promise<void> {
        if (!hasMinimumAge(input.bornAt)) {
            throw new AppError(
                `É preciso ter ${MIN_AGE_YEARS} anos ou mais para criar uma conta no Vibester`,
                400,
                "underage",
            );
        }

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
