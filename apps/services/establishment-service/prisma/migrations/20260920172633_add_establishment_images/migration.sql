-- CreateEnum
CREATE TYPE "ImageSource" AS ENUM ('SERPAPI', 'MANUAL');

-- CreateTable
CREATE TABLE "establishment_images" (
    "id" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" "ImageSource" NOT NULL DEFAULT 'SERPAPI',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "establishment_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "establishment_images_establishmentId_idx" ON "establishment_images"("establishmentId");

-- AddForeignKey
ALTER TABLE "establishment_images" ADD CONSTRAINT "establishment_images_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
