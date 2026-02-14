import { PdfDocument } from "@prisma/client";
import { VariableType } from "./pdf-template.dto.js";

 
export interface TemplateData {
  [key: string]: string | number | boolean | Date | Array<unknown> | object;
}

export interface TemplateVariables {
  [key: string]: {
    type: VariableType;
    value?: unknown;  
    required?: boolean;
  };
}

 
export interface PdfMetadata {
  [key: string]: string | number | boolean | Date | Array<unknown> | object | undefined;
}

export interface GeneratePdfData {
  templateId: string;
 data: TemplateData; 
  options?: {
    quality?: 'low' | 'medium' | 'high';
    includeMetadata?: boolean;
    filename?: string;
    expiresInHours?: number;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface GeneratePreviewData extends GeneratePdfData {
  options?: GeneratePdfData['options'] & {
    expiresInHours?: number;
  };
}

export interface PdfDocumentResponse {
  id: string;
  templateId: string;
  fileName: string;
  fileUrl: string;
  filePath?: string;
  fileSize: number;
  fileHash?: string;
  mimeType: string;
  pageCount: number;
  
  data: TemplateData; 
  variables?: TemplateVariables;  
  metadata?: PdfMetadata;  
  
  status: DocumentStatus;
  isPreview: boolean;
  expiresAt: Date | null;
  errorMessage: string | null;
  
  generationTime?: number;
  fileSizeBeforeCompression?: number;
  compressionRatio?: number;
  
  generatedBy: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;
  
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date | null;
}

export interface ListPdfDocumentsFilters {
  templateId?: string;
  status?: DocumentStatus;
  isPreview?: string; // 'true' | 'false'
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'desc'|'asc';
}
   
export interface PdfDownloadResult {
  fileName: string;
  fileSize: number;
  fileBuffer: Buffer;
  mimeType: string;
  downloadUrl?: string;
}

export type DocumentStatus = 
  | 'PENDING' | 'GENERATING' | 'GENERATED' 
  | 'FAILED' | 'EXPIRED' | 'DELETED';

  export type ExtractedVariables = Record<string, {
  type: VariableType;
  value: unknown;
  required: boolean;
}>;

// Define a type for transformed documents with additional computed fields
export interface TransformedPdfDocument extends Omit<PdfDocument, 'status' | 'data'> {
  data: TemplateData; // Override the data type
  status: DocumentStatus; // Make status specific
  fileSizeFormatted: string;
  ageInDays: number;
  expiresInHours?: number;
}

 export interface TransformedDocument extends PdfDocument {
  fileSizeFormatted: string;
  ageInDays: number;
  expiresInHours?: number;
}

export interface BatchPdfItem {
  templateId: string;
  data: TemplateData;
  options?: {
    quality?: 'low' | 'medium' | 'high';
    includeMetadata?: boolean;
    filename?: string;
    expiresInHours?: number;
  };
}

export interface BatchPdfRequestBody {
  items: BatchPdfItem[];
}