export interface EmailNotification {
  name?: string;
  to: string;
  subject: string;
  message: string;
  resetLink?: string;
}

export interface ResetPasswordData {
  name: string;
  resetLink: string;
}

export interface TwoFactorData {
  name: string;
  code: string;
}

export interface WelcomeEmailData {
  name: string;
  platformLink: string;
}
