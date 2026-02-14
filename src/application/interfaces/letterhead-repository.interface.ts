
import { LetterheadType, Prisma } from '@prisma/client';
import type { ColorProfile, DimensionsUnit, Letterhead, MarginSafeZone, Orientation, PageSize } from '../../domain/entities/letterhead.entity.js';
import { LetterheadStats } from '@application/dto/letterhead.dto.js';
import { PaginationOptions } from '@shared/types/pagination.js';

export interface LetterheadRepository {

  create(data: CreateLetterheadData): Promise<Letterhead>;
  findById(id: string): Promise<Letterhead | null>;
 
  findByName(name: string, userId: string, organizationId?: string | null): Promise<Letterhead | null>;
  update(id: string, data: Partial<Letterhead>): Promise<Letterhead>;
  delete(id: string): Promise<void>;
    findByIdIgnoreStatus(id: string): Promise<Letterhead | null>;  


  softDelete(id: string): Promise<Letterhead>;
  restore(id: string): Promise<Letterhead>;
  

  findByUser(userId: string, organizationId?: string | null): Promise<Letterhead[]>;
  findPublicById(id: string): Promise<Letterhead | null>;
 // findAll(filters?: LetterheadFilters, pagination?: PaginationOptions): Promise<{ items: Letterhead[]; total: number }>;
  

 findCategories(
  userId: string, 
  organizationId?: string | null
): Promise<Array<{category: string, usageCount: number}>>;
  exists(id: string): Promise<boolean>;
  count(filters?: LetterheadFilters): Promise<number>;
  

  getStats(userId: string, organizationId?: string | null): Promise<LetterheadStats>;
  incrementUsageCount(id: string): Promise<void>;

  findAll(
    filters?: LetterheadFilters | RepositoryLetterheadFilters,
    pagination?: PaginationOptions
  ): Promise<{ items: Letterhead[]; total: number }>;
}


export interface CreateLetterheadData {
  name: string;
  description?: string | null;
  category?: string | null;
 
  fileSize: number;
  fileType: LetterheadType ;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  dpi?: number | null;
  backgroundColor?: string | null;
  opacity?: number | null;
  marginSafeZone?: MarginSafeZone | null;
  isActive?: boolean;
  isPublic?: boolean;
  isSystem?: boolean;
  usageCount?: number;
   userId: string;   
  organizationId?: string | null;
  createdAt?: Date;  
  updatedAt?: Date;
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
 
  parentId?: string;
  lastUsedAt?: Date;

 
  
 
  version?: string;
}
 


export interface RepositoryLetterheadFilters {
  userId?: string | Prisma.UuidFilter<"Letterhead">;
  organizationId?: string | null;
  category?: string;
  isActive?: boolean;
  isPublic?: boolean;
  fileType?: LetterheadType;
  deletedAt?: Date | null;
  search?: string;
    userAccessConditions?: Array<{
    userId?: string;
    organizationId?: string | null;
    isSystem?: boolean;
    isPublic?: boolean;
    isActive?: boolean;
  }>;
  excludeDeleted?: boolean;
}

// Keep your original interface for use cases
export interface LetterheadFilters extends RepositoryLetterheadFilters {
  AND?: Prisma.LetterheadWhereInput[];
  OR?: Prisma.LetterheadWhereInput[];
  NOT?: Prisma.LetterheadWhereInput[];
  name?: Prisma.StringFilter;
  description?: Prisma.StringFilter;

 
 
}