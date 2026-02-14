
import { BackgroundType, ClonePdfTemplateData, CreatePdfTemplateData, Orientation, PageSize } from '@application/dto/pdf-template.dto.js';
import type { PdfTemplate } from '../../domain/entities/pdf-template.entity.js';
import { PaginationOptions } from '@shared/types/pagination.js';
import { Prisma } from '@prisma/client';

export interface PdfTemplateRepository {

  create(data: CreatePdfTemplateData): Promise<PdfTemplate>;
  findById(id: string): Promise<PdfTemplate | null>;
  findByName(name: string, userId: string, organizationId?: string | null): Promise<PdfTemplate | null>;
  update(id: string, data: Partial<PdfTemplate>): Promise<PdfTemplate>;
  delete(id: string): Promise<void>;
  

  softDelete(id: string): Promise<PdfTemplate>;
  restore(id: string): Promise<PdfTemplate>;
  

  findByUser(userId: string, organizationId?: string | null): Promise<PdfTemplate[]>;
  findPublicById(id: string): Promise<PdfTemplate | null>;
  findAll(filters?: PdfTemplateFilters, pagination?: PaginationOptions): Promise<{ items: PdfTemplate[]; total: number }>;
  

  findCategories(userId: string, organizationId?: string | null): Promise<string[]>;
  exists(id: string): Promise<boolean>;
  count(filters?: PdfTemplateFilters): Promise<number>;
  

  incrementViewCount(templateId: string): Promise<void>;
  incrementGenerationCount(templateId: string): Promise<void>;
  incrementPreviewCount(templateId: string): Promise<void>;
  incrementDownloadCount(templateId: string): Promise<void>;
clone(existingTemplate: PdfTemplate, createData: CreatePdfTemplateData ): Promise<PdfTemplate>;

  }


 

export interface PdfTemplateFilters {
  userId?: string;
  organizationId?: string | null;
  category?: string;
  isActive?: boolean;
  isPublic?: boolean;
  search?: string;
  excludeDeleted?: boolean;
      
}

 