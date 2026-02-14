 import { PdfMetadata, TemplateData, TemplateVariables } from "@application/dto/generate-pdf.dto.js";
import { PdfTemplate } from "./pdf-template.entity.js";
 
 

export interface PdfDocument {
  id: string;
  templateId: string;
  template?: PdfTemplate;
  fileName: string;
  fileUrl: string;
  filePath: string | null;
  fileSize: number;
  fileHash: string | null;
  mimeType: string;
  pageCount: number;

  data: TemplateData;
  variables: TemplateVariables | null;
  metadata: PdfMetadata | null;

  status: string;
  isPreview: boolean;
  expiresAt: Date | null;
  errorMessage: string | null;

  generationTime: number | null;
  fileSizeBeforeCompression: number | null;
  compressionRatio: number | null;

  generatedBy: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;

  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date | null;
  deletedAt: Date | null;

  accessCount?: number;
}
 