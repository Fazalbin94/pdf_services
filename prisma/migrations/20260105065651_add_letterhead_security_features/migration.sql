/*
  Warnings:

  - A unique constraint covering the columns `[file_path]` on the table `letterheads` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "pdfs"."ColorProfile" AS ENUM ('RGB', 'CMYK', 'GRAYSCALE');

-- CreateEnum
CREATE TYPE "pdfs"."DimensionsUnit" AS ENUM ('PIXELS', 'POINTS', 'MILLIMETERS', 'INCHES');

-- CreateEnum
CREATE TYPE "pdfs"."ZoneType" AS ENUM ('HEADER', 'FOOTER', 'SIDEBAR_LEFT', 'SIDEBAR_RIGHT', 'WATERMARK', 'BACKGROUND');

-- DropIndex
DROP INDEX "pdfs"."letterheads_file_type_idx";

-- AlterTable
ALTER TABLE "pdfs"."letterheads" ADD COLUMN     "bleed_area_size" INTEGER,
ADD COLUMN     "brand_colors" TEXT[],
ADD COLUMN     "color_profile" "pdfs"."ColorProfile" NOT NULL DEFAULT 'RGB',
ADD COLUMN     "dimensions_unit" "pdfs"."DimensionsUnit" NOT NULL DEFAULT 'POINTS',
ADD COLUMN     "file_path" TEXT,
ADD COLUMN     "has_bleed_area" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "margins" JSONB DEFAULT '{"top":57.6,"right":18,"bottom":36,"left":18}',
ADD COLUMN     "orientation" "pdfs"."Orientation" NOT NULL DEFAULT 'PORTRAIT',
ADD COLUMN     "paper_size" "pdfs"."PageSize" NOT NULL DEFAULT 'A4',
ADD COLUMN     "parent_id" UUID,
ADD COLUMN     "primary_font" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "safe_zones" JSONB,
ADD COLUMN     "secondary_font" TEXT,
ADD COLUMN     "thumbnail_path" TEXT,
ADD COLUMN     "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
ALTER COLUMN "file_url" DROP NOT NULL;

-- CreateTable
CREATE TABLE "pdfs"."letterhead_content_zones" (
    "id" UUID NOT NULL,
    "letterhead_id" UUID NOT NULL,
    "zoneType" "pdfs"."ZoneType" NOT NULL,
    "position" JSONB NOT NULL,
    "content" JSONB,
    "styles" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "letterhead_content_zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "letterhead_content_zones_letterhead_id_idx" ON "pdfs"."letterhead_content_zones"("letterhead_id");

-- CreateIndex
CREATE INDEX "letterhead_content_zones_letterhead_id_zoneType_idx" ON "pdfs"."letterhead_content_zones"("letterhead_id", "zoneType");

-- CreateIndex
CREATE INDEX "letterheads_is_public_idx" ON "pdfs"."letterheads"("is_public");

-- CreateIndex
CREATE INDEX "letterheads_deleted_at_idx" ON "pdfs"."letterheads"("deleted_at");

-- CreateIndex
CREATE INDEX "letterheads_file_path_idx" ON "pdfs"."letterheads"("file_path");

-- CreateIndex
CREATE INDEX "letterheads_last_used_at_idx" ON "pdfs"."letterheads"("last_used_at");

-- CreateIndex
CREATE UNIQUE INDEX "unique_letterheads_file_path" ON "pdfs"."letterheads"("file_path");

-- AddForeignKey
ALTER TABLE "pdfs"."letterheads" ADD CONSTRAINT "letterheads_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "pdfs"."letterheads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdfs"."letterhead_content_zones" ADD CONSTRAINT "letterhead_content_zones_letterhead_id_fkey" FOREIGN KEY ("letterhead_id") REFERENCES "pdfs"."letterheads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
