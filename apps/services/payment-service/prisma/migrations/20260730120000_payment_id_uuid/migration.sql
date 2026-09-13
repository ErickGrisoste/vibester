-- AlterTable: convert "id" from BIGSERIAL to UUID (gen_random_uuid(), built into Postgres 13+)
ALTER TABLE "payments" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "id" TYPE UUID USING gen_random_uuid();
ALTER TABLE "payments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
DROP SEQUENCE IF EXISTS "payments_id_seq";
