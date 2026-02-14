-- AlterTable
ALTER TABLE "pdfs"."pdf_generation_jobs" ADD COLUMN     "organization_id" UUID,
ADD COLUMN     "user_id" UUID;

-- CreateIndex
CREATE INDEX "pdf_generation_jobs_user_id_idx" ON "pdfs"."pdf_generation_jobs"("user_id");

-- CreateIndex
CREATE INDEX "pdf_generation_jobs_organization_id_idx" ON "pdfs"."pdf_generation_jobs"("organization_id");
