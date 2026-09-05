-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "recipient_id" VARCHAR(255) NOT NULL,
    "actor_id" VARCHAR(255) NOT NULL,
    "ref_id" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_codes" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_notifications_recipient_read_created" ON "notifications"("recipient_id", "read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_recipient_type_ref" ON "notifications"("recipient_id", "type", "ref_id");

-- CreateIndex
CREATE INDEX "idx_two_factor_codes_email_used" ON "two_factor_codes"("email", "used", "expires_at");
