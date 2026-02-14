 import { DocumentStatus, TemplateData, TemplateVariables, PdfMetadata } from "@application/dto/generate-pdf.dto.js";
import { PdfDocument } from "@domain/entities/pdf-document.entity.js";
import { PdfTemplate } from "@prisma/client";
import { PaginationOptions } from "@shared/types/pagination.js";
 
export interface IPdfDocumentRepository {
  // Type-safe create method
  create(data: CreatePdfDocumentData): Promise<PdfDocument>;
  
  // Find methods
  findById(id: string): Promise<PdfDocument | null>;
  
  // Updated findByIdWithRelations with proper return type
  findByIdWithRelations(id: string): Promise<PdfDocumentWithRelations | null>;
  
  // Updated findByUser with proper filters and return type
  findByUser(
    userId: string, 
    filters?: PdfDocumentFilters
  ): Promise<{ items: PdfDocument[]; total: number }>;
  
  // Updated findAll with proper types
  findAll(
    filters?: PdfDocumentFilters, 
    pagination?: PaginationOptions
  ): Promise<{ items: PdfDocument[]; total: number }>;
  
  // Update method
  update(id: string, data: UpdatePdfDocumentData): Promise<PdfDocument>;
  
  // Delete methods
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<PdfDocument>;
  restore(id: string): Promise<PdfDocument>;
  
  // Access tracking
  incrementAccessCount(id: string): Promise<void>;
  
  // Stats with proper return type
  getStats(
    userId: string, 
    filters?: DocumentStatsFilters
  ): Promise<DocumentStats>;
}
export interface StorageFileInfo {
  url: string;          
  path: string;         
  publicUrl: string;   
  fileId: string;      
  provider?: 's3' | 'gcs' | 'azure' | 'local';
  bucket?: string;
  region?: string;
  metadata?: Record<string, unknown>;
}
 
export interface CreatePdfDocumentData {
  templateId: string;
  fileName: string;
 
  filePath?: string | null;
  fileSize: number;
  fileHash?: string | null;
  mimeType?: string;
  pageCount: number;
  
  fileUrl: string | StorageFileInfo;
  data: TemplateData;
  variables?: TemplateVariables | null;
  metadata?: PdfMetadata | null;
  
  status?: DocumentStatus;
  isPreview?: boolean;
  expiresAt?: Date | null;
  errorMessage?: string | null;
  
  generationTime?: number | null;
  fileSizeBeforeCompression?: number | null;
  compressionRatio?: number | null;
  
  generatedBy?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  
  createdAt?: Date | null;
  updatedAt?: Date | null;
  accessedAt?: Date | null;
  deletedAt?: Date | null;
}

// Update interface for existing documents
export interface UpdatePdfDocumentData extends Partial<CreatePdfDocumentData> {
  accessedAt?: Date | null;
  deletedAt?: Date | null;
  errorMessage?: string | null;
  status?: DocumentStatus;
}

 
export interface PdfDocumentFilters {
  templateId?: string;
  generatedBy?: string;
  status?: DocumentStatus;
  isPreview?: boolean;
  fromDate?: Date;
  toDate?: Date;
  toDateExclusive?: Date;
  search?: string;
  excludeDeleted?: boolean;
  includeDeleted?: boolean;
  organizationId?: string;
  userId?: string;
  categories?: string[];
  tags?: string[];
  filename?: string;
  minFileSize?: number;
  maxFileSize?: number;
}

// Pagination options remain the same
 

 
export interface RegenerateDocumentBody {
 
  data?: TemplateData;
  options?: {
    quality?: 'low' | 'medium' | 'high';
    includeMetadata?: boolean;
    filename?: string;
    expiresInHours?: number;
    updateExisting?: boolean;
  };
}

// Additional interfaces for better type safety
 
export interface PdfDocumentWithRelations extends PdfDocument {
 
 
  user?: {
    id: string;
    name: string;
    email: string;
  };
  organization?: {
    id: string;
    name: string;
  } | null;
}

// Stats interface
export interface DocumentStatsFilters {
  period?:  'hour' |'day' | 'week' | 'month' | 'year' | 'custom';
  templateId?: string;
  fromDate?: Date;
  toDate?: Date;
  userId?: string;
  organizationId?: string;
  status?: DocumentStatus;
  isPreview?: boolean;

    
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'desc'|'asc';
}

export interface DocumentStats {
  totalDocuments: number;
  totalSize: number; // in bytes
  averageSize: number; // in bytes
  byStatus: Record<DocumentStatus, number>;
  byTemplate?: Array<{
    templateId: string;
    templateName: string;
    count: number;
    totalSize: number;
  }>;
  byUser?: Array<{
    userId: string;
    userName: string;
    count: number;
    totalSize: number;
  }>;
  byDate?: Array<{
    date: string;  
    count: number;
    totalSize: number;
  }>;
  previews: {
    total: number;
    expired: number;
    active: number;
  };
  recentActivity?: Array<{
    date: Date;
    action: 'created' | 'accessed' | 'deleted';
    count: number;
  }>;
}

// Search result interface for advanced searching
export interface PdfDocumentSearchResult {
  id: string;
  fileName: string;
  fileUrl: string;
  templateName: string;
  templateId: string;
  createdAt: Date;
  fileSize: number;
  pageCount: number;
  status: DocumentStatus;
  score?: number; // For full-text search relevance
}

export interface PdfDocumentSearchOptions {
  query: string;
  userId?: string;
  organizationId?: string;
  templateId?: string;
  limit?: number;
  offset?: number;
  includeContent?: boolean; // Whether to search in data content
}

// Export type for repository
export type PdfDocumentRepository = IPdfDocumentRepository;

  
export type PublicPdfDocument =
  Omit<
    PdfDocument,
    | 'filePath'
    | 'fileHash'
    | 'generationTime'
    | 'fileSizeBeforeCompression'
    | 'compressionRatio'
    | 'generatedBy'
    | 'ipAddress'
    | 'userAgent'
    | 'referrer'
    | 'deletedAt'
  > & {
    metadata: PdfMetadata | null;
  };


 