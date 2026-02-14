 
import { LetterheadStats, ListLetterheadsFilters, NormalizedFilters, PublicLetterhead } from '@application/dto/letterhead.dto.js';
import type { Letterhead } from '../../../domain/entities/letterhead.entity.js';
import { LetterheadError } from '../../../domain/errors/letterhead-error.js';
import { LetterheadFilters, LetterheadRepository, RepositoryLetterheadFilters } from '@application/interfaces/letterhead-repository.interface.js';
 import { LetterheadType, Prisma } from '@prisma/client';
import { PaginatedResult } from '@shared/types/pagination.js';

export class ListLetterheadsUseCase {
  constructor(private readonly letterheadRepository: LetterheadRepository) {}

    async execute(
    userId: string,
    filters: ListLetterheadsFilters = {},
    organizationId?: string | null
  ): Promise<PaginatedResult<Letterhead>> {
    try {
      const { securityOption, expiresIn, ...letterheadFilters } = filters;

     
      const normalizedFilters = this.normalizeFilters(letterheadFilters);
      const queryFilters = this.buildQueryFilters(userId, normalizedFilters, organizationId);
      
      const result = await this.letterheadRepository.findAll(
        queryFilters,
        {
          page: normalizedFilters.page,
          limit: normalizedFilters.limit,
          sortBy: normalizedFilters.sortBy,
          sortOrder: normalizedFilters.sortOrder,
           
          securityOption,
        }
      );
      const sanitizedItems = result.items.map(item => {
        // Clone the item
        const sanitized = { ...item };
        
        // Only include filePath and thumbnailPath if we need them for file retrieval
        if (securityOption === 'none') {
          // Remove paths for security
          delete sanitized.filePath;
          delete sanitized.thumbnailPath;
        }
        
        return sanitized;
      });
      const currentPage = normalizedFilters.page;
      const itemsPerPage = normalizedFilters.limit;
      const totalItems = result.total;
      const totalPages = Math.ceil(totalItems / itemsPerPage);


      return {
        items: result.items,
        pagination: {
          page: currentPage,
          limit: itemsPerPage,
          total: totalItems,
          totalPages,
          hasNext: currentPage < totalPages,
          hasPrevious: currentPage > 1,
        },
      };
    } catch (error) {
      throw new LetterheadError('LIST_FAILED', 'Failed to list letterheads', error as Error);
    }
  }



  async executeCategories(
    userId: string,
    organizationId?: string | null
  ): Promise<Array<{category: string, usageCount: number}>> {
    try {
      return await this.letterheadRepository.findCategories(userId, organizationId);
    } catch (error) {
      throw new LetterheadError(
        'GET_CATEGORIES_FAILED',
        'Failed to get letterhead categories',
        error as Error
      );
    }
  }

 async executeStats(
  userId: string,
  organizationId?: string | null
): Promise<LetterheadStats> {
  try {
    return await this.letterheadRepository.getStats(userId, organizationId);
  } catch (error) {
    throw new LetterheadError(
      'GET_STATS_FAILED',
      'Failed to get letterhead statistics',
      error as Error
    );
  }
}

 async executePublic(filters: ListLetterheadsFilters = {}): Promise<PaginatedResult<PublicLetterhead>> {
  try {
    console.log('=== executePublic ===');
    console.log('Filters received:', filters);
    
    const normalizedFilters = this.normalizeFilters(filters);
    console.log('Normalized filters:', normalizedFilters);
    
    const queryFilters = this.buildPublicQueryFilters(normalizedFilters);
    console.log('Public query filters:', JSON.stringify(queryFilters, null, 2));
    
    // Cast queryFilters to repository filter type
    const repoFilters: RepositoryLetterheadFilters = {
      ...queryFilters,
      isPublic: true,
      isActive: true,
      excludeDeleted: true
    };
    
    const result = await this.letterheadRepository.findAll(
      repoFilters,
      {
        page: normalizedFilters.page,
        limit: normalizedFilters.limit,
        sortBy: normalizedFilters.sortBy,
        sortOrder: normalizedFilters.sortOrder,
      }
    );
    
    console.log('Repository result:', {
      itemsCount: result.items.length,
      total: result.total,
    });
    
    // Validate public status
    result.items.forEach((item, index) => {
      if (!item.isPublic) {
        console.error(`❌ BUG: Item ${item.id} has isPublic: false but passed filter!`);
      }
    });
    
    // Convert to PublicLetterhead (remove sensitive fields)
    const sanitizedItems: PublicLetterhead[] = result.items.map(letterhead => 
      this.sanitizePublicLetterhead(letterhead)
    );
    
    const currentPage = normalizedFilters.page;
    const itemsPerPage = normalizedFilters.limit;
    const totalItems = result.total;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    return {
      items: sanitizedItems,
      pagination: {
        page: currentPage,
        limit: itemsPerPage,
        total: totalItems,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrevious: currentPage > 1,
      },
    };
    
  } catch (error) {
    console.error('Error in executePublic:', error);
    throw new LetterheadError(
      'LIST_PUBLIC_FAILED',
      'Failed to list public letterheads',
      error as Error
    );
  }
}

   private normalizeFilters(filters: ListLetterheadsFilters): NormalizedFilters {
    return {
      category: filters.category,
      isActive: filters.isActive === 'true' ? true : 
                filters.isActive === 'false' ? false : undefined,
      isPublic: filters.isPublic === 'true' ? true : 
                filters.isPublic === 'false' ? false : undefined,
      fileType: filters.fileType as LetterheadType | undefined,  
      search: filters.search,
      page: filters.page || 1,
      limit: Math.min(filters.limit || 20, 100),
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'desc',
    };
  }
 
  

private buildQueryFilters(
  userId: string,
  filters: NormalizedFilters,
  organizationId?: string | null
): RepositoryLetterheadFilters {
  const queryFilters: RepositoryLetterheadFilters = {
    excludeDeleted: true,
    userAccessConditions: [
      { userId, organizationId: null }, 
      { isSystem: true }, 
    ],
  };

  // Add organization condition if provided
  if (organizationId !== undefined) {
    queryFilters.userAccessConditions!.push({ organizationId });
  }

  // Add public letterheads condition
  queryFilters.userAccessConditions!.push({ 
    isPublic: true, 
    isActive: true 
  });

  // Add additional filters
  if (filters.category) queryFilters.category = filters.category;
  if (filters.isActive !== undefined) queryFilters.isActive = filters.isActive;
  if (filters.isPublic !== undefined) queryFilters.isPublic = filters.isPublic;
  if (filters.fileType) queryFilters.fileType = filters.fileType;
  if (filters.search) queryFilters.search = filters.search;

  return queryFilters;
}

 private buildPublicQueryFilters(
  filters: ReturnType<typeof this.normalizeFilters>
): RepositoryLetterheadFilters {
  const queryFilters: RepositoryLetterheadFilters = {
    isPublic: true,
    isActive: true,
    excludeDeleted: true,
  };

  if (filters.category) {
    queryFilters.category = filters.category;
  }

  if (filters.fileType) {
    queryFilters.fileType = filters.fileType as LetterheadType;
  }

  if (filters.search) {
    // This will be handled by the repository
    queryFilters.search = filters.search;
  }

  return queryFilters;
}


 private transformResults(letterheads: Letterhead[]): (Letterhead & { fileExtension: string; fileSizeFormatted: string })[] {
  return letterheads.map(letterhead => {
    return {
      ...letterhead,
      fileExtension: this.getFileExtension(letterhead.mimeType),
      fileSizeFormatted: this.formatFileSize(letterhead.fileSize),
    };
  });
}


  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'image/tiff': 'tiff',
      'image/webp': 'webp',
    };
    return extensions[mimeType] || 'file';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

 // In ListLetterheadsUseCase.sanitizePublicLetterhead method:

private sanitizePublicLetterhead(letterhead: Letterhead): PublicLetterhead {
  // Handle nullable/undefined margins
  const margins = letterhead.margins ? {
    top: (letterhead.margins as any)?.top || 0,
    right: (letterhead.margins as any)?.right || 0,
    bottom: (letterhead.margins as any)?.bottom || 0,
    left: (letterhead.margins as any)?.left || 0,
  } : {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };

  // Handle nullable/undefined safeZones
  const safeZones = letterhead.safeZones ? {
    header: {
      top: (letterhead.safeZones as any)?.header?.top || 0,
      bottom: (letterhead.safeZones as any)?.header?.bottom || 0,
      left: (letterhead.safeZones as any)?.header?.left || 0,
      right: (letterhead.safeZones as any)?.header?.right || 0,
    },
    footer: {
      top: (letterhead.safeZones as any)?.footer?.top || 0,
      bottom: (letterhead.safeZones as any)?.footer?.bottom || 0,
      left: (letterhead.safeZones as any)?.footer?.left || 0,
      right: (letterhead.safeZones as any)?.footer?.right || 0,
    }
  } : {
    header: { top: 0, bottom: 0, left: 0, right: 0 },
    footer: { top: 0, bottom: 0, left: 0, right: 0 }
  };

  return {
    id: letterhead.id,
    userId: letterhead.userId,
    organizationId: letterhead.organizationId,
    name: letterhead.name,
    description: letterhead.description,
    category: letterhead.category,
    fileSize: letterhead.fileSize,
    mimeType: letterhead.mimeType,
    width: letterhead.width,
    height: letterhead.height,
    dpi: letterhead.dpi,
    fileType: letterhead.fileType,
    marginSafeZone: letterhead.marginSafeZone,
    isActive: letterhead.isActive,
    isPublic: letterhead.isPublic,
    usageCount: letterhead.usageCount,
    updatedAt: letterhead.updatedAt,
    deletedAt: letterhead.deletedAt,
    backgroundColor: letterhead.backgroundColor,
    opacity: letterhead.opacity,
    createdAt: letterhead.createdAt,
    paperSize: letterhead.paperSize,
    orientation: letterhead.orientation,
    margins: margins,
    safeZones: safeZones,
    brandColors: letterhead.brandColors || [],
    dimensionsUnit: letterhead.dimensionsUnit,
    colorProfile: letterhead.colorProfile,
    hasBleedArea: letterhead.hasBleedArea || false,
    version: letterhead.version || '1.0.0'
  };
}

}