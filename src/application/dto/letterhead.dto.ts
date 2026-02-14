import { ColorProfile, DimensionsUnit, MarginSafeZone, Orientation, PageSize } from "@domain/entities/letterhead.entity.js";
import { LetterheadType } from "@prisma/client";
 
 
export interface CreateLetterheadData {
  name: string;
  description?: string;
  category?: string;
  backgroundColor?: string;
  opacity?: number;
  isActive?: boolean;
  isPublic?: boolean;
  isSystem?: boolean;
  organizationId?: string | null;
  sourceLetterheadId?: string | null;
    marginSafeZone?: MarginSafeZone; 
     paperSize?: PageSize;
  orientation?: Orientation;
 margins: {
    top: number;   
    right: number;  
    bottom: number; 
    left: number;   
  };
  safeZones: {
    header: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
    footer: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  };
  brandColors?: string[];
  primaryFont?: string;
  secondaryFont?: string;
  filePath?: string; 
  thumbnailPath?: string; 
  dimensionsUnit?: DimensionsUnit;
  colorProfile?: ColorProfile;
  hasBleedArea?: boolean;
  bleedAreaSize?: number;
  version?: string;
  parentId?: string;
  securityOption?: 'base64' | 'signed-url';
  expiresIn?: number;
  file: Buffer;
}

export interface UpdateLetterheadData extends Partial<CreateLetterheadData> {
  deletedAt?: Date | null;
  usageCount?: number;
  lastUsedAt?: Date  ;
  updatedAt?: Date  ;
}

export interface LetterheadFile {
  data: Buffer;
  filename: string;
  mimetype: string;
  size: number;
}

export interface ListLetterheadsFilters {
  category?: string;
  isActive?: string;
  isPublic?: string;
  fileType?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?:string;
  sortOrder?: 'asc' | 'desc' ;
  securityOption?:string;
  expiresIn?: number;
}

export interface ProcessedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  size: number;
  dimensions?: { width: number; height: number };
  dpi?: number;
  thumbnailBuffer?: Buffer;
   marginSafeZone?: MarginSafeZone;
}

export interface IImageProcessor {
  extractMetadata(buffer: Buffer): Promise<ImageMetadata>;
  extractMetadata(buffer: Buffer): Promise<ImageMetadata>;
  handlePdfDimensions(
    buffer: Buffer, 
    requestId: string
  ): Promise<{ width: number; height: number; dpi?: number }>;
    handleSvgDimensions(
    buffer: Buffer, 
    requestId: string
  ): Promise<{ width: number; height: number; dpi?: number }>;
  getBasicImageInfo(
    buffer: Buffer,
    mimetype: string,
    requestId: string
  ): { width: number; height: number; dpi?: number };

    extractJpegDimensions(
    buffer: Buffer, 
    requestId: string
  ): { width: number; height: number; dpi?: number };

    extractPngDimensions(
    buffer: Buffer, 
    requestId: string
  ): { width: number; height: number; dpi?: number };

  validatePrintDimensions?(dimensions: { width: number; height: number }): Promise<void>;
  cleanup?(): Promise<void>;  
}

export interface ImageMetadata {
  dimensions?: { width: number; height: number };
  dpi?: number;
  format?: string;
  hasAlpha?: boolean;
}

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

 
export interface IConfig {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  defaultDpi?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  thumbnailQuality?: number;
}

 export interface CreateLetterheadRequest {
  name: string;
  description?: string;
  category?: string;
  backgroundColor?: string;
  opacity?: number;
  isActive?: boolean;
  isPublic?: boolean;
  organizationId?: string | null;
}

 export interface CreateLetterheadInput {
  name: string;
  description?: string;
  category?: string;
  backgroundColor?: string;
  opacity?: number;
  isActive?: boolean;
  isPublic?: boolean;
  organizationId?: string | null;
    sourceLetterheadId: string;  

}

export interface UpdateLetterheadRequest extends Partial<CreateLetterheadRequest> {
  deletedAt?: Date | null;
  usageCount?: number;
}

export interface LetterheadFile {
  data: Buffer;
  filename: string;
  mimetype: string;
  size: number;
}

export interface ListLetterheadsFilters {
  category?: string;
  isActive?: string;
  isPublic?: string;
  fileType?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface LetterheadStats {
  total: number;
  active: number;
  public: number;
  totalUsage: number;
  avgUsage: number;
  fileTypes: Array<{
    type: LetterheadType;
    count: number;
  }>;
}
export interface PublicLetterhead {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
 
  fileSize: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  dpi: number | null;
  fileType: LetterheadType;
  backgroundColor: string | null;
  opacity: number | null;
  marginSafeZone: MarginSafeZone | null;
  isActive: boolean;
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date | null | undefined;


 
  userId: string;
  organizationId?: string | null;
  
 
  deletedAt: Date | null;

 paperSize: PageSize;
  orientation: Orientation;
 margins: {
    top: number;   
    right: number;  
    bottom: number; 
    left: number;   
  };
  safeZones: {
    header: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
    footer: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  };
  brandColors: string[];
  primaryFont?: string;
  secondaryFont?: string;
  filePath?: string;
  thumbnailPath?: string;
  dimensionsUnit: DimensionsUnit;
  colorProfile: ColorProfile;
  hasBleedArea: boolean;
  bleedAreaSize?: number;
  lastUsedAt?: Date;
  version: string;
  parentId?: string;
  fileSignedUrl?: string;
  thumbnailSignedUrl?: string;
  signedUrlExpiresAt?: Date;

}

export interface NormalizedFilters {
  category?: string;
  isActive?: boolean;
  isPublic?: boolean;
  fileType?: LetterheadType;
  search?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

  