import { LetterheadType, Prisma } from "@prisma/client";

 export interface Letterhead {
  id: string;
  userId: string;
  organizationId: string | null;
  
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
  
  // Define proper type for marginSafeZone
  marginSafeZone: MarginSafeZone | null;
  
  isActive: boolean;
  isPublic: boolean;
  isSystem: boolean;
  
  usageCount: number;
  
  createdAt: Date;
  updatedAt: Date ;
  deletedAt: Date | null;
  publishedAt: Date | null;

 
 paperSize: PageSize;
  orientation: Orientation;
 
 
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
  
  
 on: 'PORTRAIT' | 'LANDSCAPE';
  
  
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
    headerContent?: {
    logo?: {
      position: 'LEFT' | 'CENTER' | 'RIGHT';
      maxWidth: number;
      maxHeight: number;
    };
    companyName?: {
      text: string;
      position: 'LEFT' | 'CENTER' | 'RIGHT';
      fontSize: number;
    };
  };
   footerContent?: {
    contactInfo: {
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
      position: 'LEFT' | 'CENTER' | 'RIGHT' | 'SPLIT';
    };
    legalInfo?: {
      registrationNumber?: string;
      vatNumber?: string;
      disclaimer?: string;
    };
  };
   backgroundFile?: {
    type: 'IMAGE' | 'PDF' | 'SVG';
    url: string;
    opacity: number; // 0-1
    size: {
      width: number;
      height: number;
      dpi: number; 
    };
  };
  
  // Print Quality Standards
  printQuality: {
    minimumDpi: number;  
    colorProfile: 'CMYK' | 'RGB';
    bleedArea?: number;  
  };
  
 

}

 
  export type PageSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'LETTER' | 'LEGAL' | 'TABLOID' | 'CUSTOM';
  export type Orientation = 'PORTRAIT' | 'LANDSCAPE';
  export type DimensionsUnit = 'PIXELS' | 'POINTS' | 'MILLIMETERS' | 'INCHES';
  export type ColorProfile = 'RGB' | 'CMYK' | 'GRAYSCALE';
  export interface MarginSafeZone  extends Prisma.JsonObject {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

 

 
 

 
export interface LetterheadCreateInput {
  userId: string;
  organizationId?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  
  fileSize: number;
  fileType: LetterheadType;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  dpi?: number | null;
  backgroundColor?: string | null;
  opacity?: number | null;
  marginSafeZone?: MarginSafeZone | null;
  isActive: boolean;
  isPublic: boolean;
  isSystem?: boolean;
  usageCount?: number;
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
    paperSize?: PageSize;
  orientation?: Orientation;
 
  brandColors?: string[];
  primaryFont?: string;
  secondaryFont?: string;
  filePath?: string; 
  thumbnailPath?: string;
  dimensionsUnit?: DimensionsUnit;
  colorProfile?: ColorProfile;
  hasBleedArea?: boolean;
  bleedAreaSize?: number;
  lastUsedAt?: Date;
  version?: string;
  parentId?: string;
}

export interface LetterheadUpdateInput extends Partial<LetterheadCreateInput> {
  deletedAt?: Date | null;
  updatedAt?: Date ;
}