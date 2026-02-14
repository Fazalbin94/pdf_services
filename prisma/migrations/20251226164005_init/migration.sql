-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pdfs";

-- CreateEnum
CREATE TYPE "pdfs"."PageSize" AS ENUM ('A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'LETTER', 'LEGAL', 'TABLOID', 'CUSTOM');

-- CreateEnum
CREATE TYPE "pdfs"."Orientation" AS ENUM ('PORTRAIT', 'LANDSCAPE');

-- CreateEnum
CREATE TYPE "pdfs"."BackgroundType" AS ENUM ('NONE', 'COLOR', 'IMAGE', 'PDF', 'LETTERHEAD');

-- CreateEnum
CREATE TYPE "pdfs"."LetterheadType" AS ENUM ('IMAGE', 'PDF', 'SVG');

-- CreateEnum
CREATE TYPE "pdfs"."DocumentStatus" AS ENUM ('PENDING', 'GENERATING', 'GENERATED', 'FAILED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "pdfs"."AccessAction" AS ENUM ('VIEW', 'GENERATE', 'DOWNLOAD', 'SHARE', 'EDIT', 'DELETE', 'PREVIEW');

-- CreateEnum
CREATE TYPE "pdfs"."DocumentAccessAction" AS ENUM ('DOWNLOAD', 'VIEW', 'PRINT', 'SHARE', 'EMBED');

-- CreateEnum
CREATE TYPE "pdfs"."JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "pdfs"."pdf_templates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "tags" TEXT[],
    "config" JSONB NOT NULL,
    "variables" JSONB,
    "defaultData" JSONB,
    "validation_rules" JSONB,
    "page_size" "pdfs"."PageSize" NOT NULL DEFAULT 'A4',
    "orientation" "pdfs"."Orientation" NOT NULL DEFAULT 'PORTRAIT',
    "margins" JSONB,
    "fonts" JSONB,
    "styles" JSONB,
    "background_type" "pdfs"."BackgroundType" NOT NULL DEFAULT 'NONE',
    "background_url" TEXT,
    "background_color" VARCHAR(20),
    "opacity" DOUBLE PRECISION DEFAULT 1.0,
    "header_content" JSONB,
    "footer_content" JSONB,
    "letterhead_id" UUID,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "thumbnail_url" TEXT,
    "estimated_pages" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pdf_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdfs"."pdf_template_stats" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "generation_count" INTEGER NOT NULL DEFAULT 0,
    "preview_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMP(3),
    "last_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_template_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdfs"."pdf_template_access_logs" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "user_id" UUID,
    "action" "pdfs"."AccessAction" NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_template_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdfs"."pdf_documents" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_path" TEXT,
    "file_size" INTEGER NOT NULL,
    "file_hash" VARCHAR(64),
    "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "page_count" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "variables" JSONB,
    "metadata" JSONB,
    "status" "pdfs"."DocumentStatus" NOT NULL DEFAULT 'GENERATED',
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "error_message" TEXT,
    "generation_time" INTEGER,
    "file_size_before_compression" INTEGER,
    "compression_ratio" DOUBLE PRECISION,
    "generated_by" UUID,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "referrer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "accessed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pdf_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdfs"."pdf_document_access_logs" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "user_id" UUID,
    "action" "pdfs"."DocumentAccessAction" NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "download_time" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdfs"."letterheads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "file_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "file_size" INTEGER NOT NULL,
    "file_type" "pdfs"."LetterheadType" NOT NULL DEFAULT 'IMAGE',
    "mime_type" VARCHAR(100) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "dpi" INTEGER DEFAULT 300,
    "background_color" VARCHAR(20),
    "opacity" DOUBLE PRECISION DEFAULT 1.0,
    "margin_safe_zone" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "letterheads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdfs"."pdf_generation_jobs" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "options" JSONB,
    "callback_url" TEXT,
    "status" "pdfs"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "document_id" UUID,
    "error_message" TEXT,
    "error_stack" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "timeout_at" TIMESTAMP(3),
    "queue_name" VARCHAR(50),
    "worker_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdf_templates_user_id_idx" ON "pdfs"."pdf_templates"("user_id");

-- CreateIndex
CREATE INDEX "pdf_templates_organization_id_idx" ON "pdfs"."pdf_templates"("organization_id");

-- CreateIndex
CREATE INDEX "pdf_templates_category_idx" ON "pdfs"."pdf_templates"("category");

-- CreateIndex
CREATE INDEX "pdf_templates_is_active_idx" ON "pdfs"."pdf_templates"("is_active");

-- CreateIndex
CREATE INDEX "pdf_templates_is_public_idx" ON "pdfs"."pdf_templates"("is_public");

-- CreateIndex
CREATE INDEX "pdf_templates_created_at_idx" ON "pdfs"."pdf_templates"("created_at");

-- CreateIndex
CREATE INDEX "pdf_templates_deleted_at_idx" ON "pdfs"."pdf_templates"("deleted_at");

-- CreateIndex
CREATE INDEX "pdf_templates_user_id_category_idx" ON "pdfs"."pdf_templates"("user_id", "category");

-- CreateIndex
CREATE INDEX "pdf_templates_organization_id_category_idx" ON "pdfs"."pdf_templates"("organization_id", "category");

-- CreateIndex
CREATE INDEX "pdf_templates_is_active_is_public_idx" ON "pdfs"."pdf_templates"("is_active", "is_public");

-- CreateIndex
CREATE INDEX "pdf_templates_letterhead_id_idx" ON "pdfs"."pdf_templates"("letterhead_id");

-- CreateIndex
CREATE UNIQUE INDEX "pdf_templates_user_id_name_key" ON "pdfs"."pdf_templates"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "pdf_templates_organization_id_name_key" ON "pdfs"."pdf_templates"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "pdf_template_stats_template_id_key" ON "pdfs"."pdf_template_stats"("template_id");

-- CreateIndex
CREATE INDEX "pdf_template_access_logs_template_id_idx" ON "pdfs"."pdf_template_access_logs"("template_id");

-- CreateIndex
CREATE INDEX "pdf_template_access_logs_user_id_idx" ON "pdfs"."pdf_template_access_logs"("user_id");

-- CreateIndex
CREATE INDEX "pdf_template_access_logs_action_idx" ON "pdfs"."pdf_template_access_logs"("action");

-- CreateIndex
CREATE INDEX "pdf_template_access_logs_created_at_idx" ON "pdfs"."pdf_template_access_logs"("created_at");

-- CreateIndex
CREATE INDEX "pdf_template_access_logs_template_id_action_idx" ON "pdfs"."pdf_template_access_logs"("template_id", "action");

-- CreateIndex
CREATE INDEX "pdf_documents_template_id_idx" ON "pdfs"."pdf_documents"("template_id");

-- CreateIndex
CREATE INDEX "pdf_documents_generated_by_idx" ON "pdfs"."pdf_documents"("generated_by");

-- CreateIndex
CREATE INDEX "pdf_documents_status_idx" ON "pdfs"."pdf_documents"("status");

-- CreateIndex
CREATE INDEX "pdf_documents_is_preview_idx" ON "pdfs"."pdf_documents"("is_preview");

-- CreateIndex
CREATE INDEX "pdf_documents_created_at_idx" ON "pdfs"."pdf_documents"("created_at");

-- CreateIndex
CREATE INDEX "pdf_documents_expires_at_idx" ON "pdfs"."pdf_documents"("expires_at");

-- CreateIndex
CREATE INDEX "pdf_documents_deleted_at_idx" ON "pdfs"."pdf_documents"("deleted_at");

-- CreateIndex
CREATE INDEX "pdf_documents_template_id_status_idx" ON "pdfs"."pdf_documents"("template_id", "status");

-- CreateIndex
CREATE INDEX "pdf_documents_generated_by_created_at_idx" ON "pdfs"."pdf_documents"("generated_by", "created_at");

-- CreateIndex
CREATE INDEX "pdf_documents_is_preview_expires_at_idx" ON "pdfs"."pdf_documents"("is_preview", "expires_at");

-- CreateIndex
CREATE INDEX "pdf_document_access_logs_document_id_idx" ON "pdfs"."pdf_document_access_logs"("document_id");

-- CreateIndex
CREATE INDEX "pdf_document_access_logs_user_id_idx" ON "pdfs"."pdf_document_access_logs"("user_id");

-- CreateIndex
CREATE INDEX "pdf_document_access_logs_action_idx" ON "pdfs"."pdf_document_access_logs"("action");

-- CreateIndex
CREATE INDEX "pdf_document_access_logs_created_at_idx" ON "pdfs"."pdf_document_access_logs"("created_at");

-- CreateIndex
CREATE INDEX "pdf_document_access_logs_document_id_action_idx" ON "pdfs"."pdf_document_access_logs"("document_id", "action");

-- CreateIndex
CREATE INDEX "letterheads_user_id_idx" ON "pdfs"."letterheads"("user_id");

-- CreateIndex
CREATE INDEX "letterheads_organization_id_idx" ON "pdfs"."letterheads"("organization_id");

-- CreateIndex
CREATE INDEX "letterheads_category_idx" ON "pdfs"."letterheads"("category");

-- CreateIndex
CREATE INDEX "letterheads_is_active_idx" ON "pdfs"."letterheads"("is_active");

-- CreateIndex
CREATE INDEX "letterheads_file_type_idx" ON "pdfs"."letterheads"("file_type");

-- CreateIndex
CREATE INDEX "letterheads_created_at_idx" ON "pdfs"."letterheads"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "letterheads_user_id_name_key" ON "pdfs"."letterheads"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "letterheads_organization_id_name_key" ON "pdfs"."letterheads"("organization_id", "name");

-- CreateIndex
CREATE INDEX "pdf_generation_jobs_template_id_idx" ON "pdfs"."pdf_generation_jobs"("template_id");

-- CreateIndex
CREATE INDEX "pdf_generation_jobs_status_idx" ON "pdfs"."pdf_generation_jobs"("status");

-- CreateIndex
CREATE INDEX "pdf_generation_jobs_priority_idx" ON "pdfs"."pdf_generation_jobs"("priority");

-- CreateIndex
CREATE INDEX "pdf_generation_jobs_scheduled_at_idx" ON "pdfs"."pdf_generation_jobs"("scheduled_at");

-- CreateIndex
CREATE INDEX "pdf_generation_jobs_created_at_idx" ON "pdfs"."pdf_generation_jobs"("created_at");

-- CreateIndex
CREATE INDEX "pdf_generation_jobs_status_priority_idx" ON "pdfs"."pdf_generation_jobs"("status", "priority");

-- CreateIndex
CREATE INDEX "pdf_generation_jobs_status_scheduled_at_idx" ON "pdfs"."pdf_generation_jobs"("status", "scheduled_at");

-- AddForeignKey
ALTER TABLE "pdfs"."pdf_templates" ADD CONSTRAINT "pdf_templates_letterhead_id_fkey" FOREIGN KEY ("letterhead_id") REFERENCES "pdfs"."letterheads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdfs"."pdf_template_stats" ADD CONSTRAINT "pdf_template_stats_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "pdfs"."pdf_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdfs"."pdf_template_access_logs" ADD CONSTRAINT "pdf_template_access_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "pdfs"."pdf_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdfs"."pdf_documents" ADD CONSTRAINT "pdf_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "pdfs"."pdf_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdfs"."pdf_document_access_logs" ADD CONSTRAINT "pdf_document_access_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "pdfs"."pdf_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdfs"."pdf_generation_jobs" ADD CONSTRAINT "pdf_generation_jobs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "pdfs"."pdf_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdfs"."pdf_generation_jobs" ADD CONSTRAINT "pdf_generation_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "pdfs"."pdf_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
