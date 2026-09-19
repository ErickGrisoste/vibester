-- CreateTable
CREATE TABLE IF NOT EXISTS "payments" (
    "id"          BIGSERIAL PRIMARY KEY,
    "bill_id"     TEXT NOT NULL,
    "external_id" TEXT,
    "amount"      INTEGER NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'PENDING',
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payments_bill_id_key" ON "payments"("bill_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_external_id_idx" ON "payments"("external_id");
