import crypto from "crypto";
import prismaClient from "../prisma";

export function generateTwoFactorCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function saveTwoFactorCode(email: string, code: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prismaClient.twoFactorCode.create({
    data: {
      email,
      code,
      expiresAt,
    },
  });
}

export async function validateTwoFactorCode(email: string, code: string): Promise<boolean> {
  const found = await prismaClient.twoFactorCode.findFirst({
    where: {
      email,
      code,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  return !!found;
}

export async function markTwoFactorCodeAsUsed(email: string, code: string): Promise<void> {
  await prismaClient.twoFactorCode.updateMany({
    where: {
      email,
      code,
      used: false,
    },
    data: {
      used: true,
    },
  });
}
