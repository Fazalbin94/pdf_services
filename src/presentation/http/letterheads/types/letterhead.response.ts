import { MarginSafeZone, Orientation, PageSize } from "@domain/entities/letterhead.entity.js";
import { ColorProfile, DimensionsUnit, LetterheadType } from "@prisma/client";

 
export interface LetterheadBaseData {
    id: string;
    name: string;
    description?: string;
    category?: string;
    mimeType: string;
    fileSize: number;
    width?: number;
    height?: number;
    dpi?: number;
 
  
    isActive: boolean;
    isPublic: boolean;
    usageCount: number;
    createdAt: Date;
    updatedAt: Date;
    
    
    // Layout properties
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
    brandColors?: string[];
    primaryFont?: string;
    secondaryFont?: string;
    
    // File properties
    fileType: LetterheadType;
 
    filePath?: string;
    thumbnailPath?: string;
   
    dimensionsUnit: DimensionsUnit;
    colorProfile: ColorProfile;
    hasBleedArea: boolean;
    bleedAreaSize?: number;
    
    // Appearance
    backgroundColor?: string;
    opacity?: number;
    marginSafeZone?: MarginSafeZone;
    
    // Status & Ownership
 
    isSystem: boolean;
 
    userId?: string;
    organizationId?: string | null;
    
     
    lastUsedAt?: Date;
    publishedAt?: Date;
    deletedAt?: Date;
    
    // Relations & Versioning
    parentId?: string;
    version: string;
  }
  
  export interface LetterheadBase64Response extends LetterheadBaseData {
    fileBase64: string;
    thumbnailBase64?: string;
  }
  
  export interface LetterheadSignedUrlResponse extends LetterheadBaseData {
    fileSignedUrl: string;
    thumbnailSignedUrl?: string;
    signedUrlExpiresAt: string;
  }
  
  export type LetterheadResponse = LetterheadBase64Response | LetterheadSignedUrlResponse;
  
  export interface DownloadFileResult {
    buffer: Buffer;
    mimeType: string;
    size: number;
  }
  