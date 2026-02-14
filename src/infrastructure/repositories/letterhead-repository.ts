// src/infrastructure/repositories/letterhead-repository.ts
 
 import { LetterheadType, PrismaClient } from '@prisma/client';
import type { Letterhead, MarginSafeZone } from '../../domain/entities/letterhead.entity.js';
   import { Prisma } from '@prisma/client';

import { LetterheadError } from '../../domain/errors/letterhead-error.js';
import { CreateLetterheadData, LetterheadFilters, LetterheadRepository, RepositoryLetterheadFilters  } from '@application/interfaces/letterhead-repository.interface.js';
 import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { LetterheadStats } from '@application/dto/letterhead.dto.js';
import { PaginationOptions } from '@shared/types/pagination.js';

export class PrismaLetterheadRepository implements LetterheadRepository {
  constructor(private readonly prisma: PrismaClient) {}
async findByIdIgnoreStatus(id: string): Promise<Letterhead | null> {
  try {
    const letterhead = await this.prisma.letterhead.findUnique({
      where: { id },
    });
    
    if (!letterhead) return null;
    
    return this.mapToDomain(letterhead);
  } catch (error) {
    console.error('Error in findByIdIgnoreStatus:', error);
    return null;
  }
}
  async create(data: CreateLetterheadData): Promise<Letterhead> {
    try {
      const letterhead = await this.prisma.letterhead.create({
        data: {
          userId: data.userId,
          organizationId: data.organizationId,
          name: data.name,
          description: data.description,
          category: data.category,
       
          fileSize: data.fileSize,
          fileType: data.fileType,
          mimeType: data.mimeType,
          width: data.width,
          height: data.height,
          dpi: data.dpi || 300,
          backgroundColor: data.backgroundColor,
          opacity: data.opacity || 1.0,
          marginSafeZone: JSON.parse(JSON.stringify(data.marginSafeZone!)),
          isActive: data.isActive ?? true,
          isPublic: data.isPublic ?? false,
          isSystem: data.isSystem ?? false,
          usageCount: data.usageCount || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          paperSize: data.paperSize || 'A4',
        orientation: data.orientation || 'PORTRAIT',
        margins: data.margins || { top: 57.6, right: 18, bottom: 36, left: 18 },
        safeZones: data.safeZones,
        brandColors: data.brandColors || ['#000000', '#FFFFFF'],
        primaryFont: data.primaryFont,
        secondaryFont: data.secondaryFont,
        filePath: data.filePath, // ADD THIS - important!
        thumbnailPath: data.thumbnailPath,
        dimensionsUnit: data.dimensionsUnit || 'POINTS',
        colorProfile: data.colorProfile || 'RGB',
        hasBleedArea: data.hasBleedArea || false,
        bleedAreaSize: data.bleedAreaSize,
        version: data.version || '1.0.0',
        parentId: data.parentId,
        lastUsedAt: data.lastUsedAt || undefined,
//
 











        },
      });

      return this.mapToDomain(letterhead);
    } 
     catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new LetterheadError(
        'DUPLICATE_ENTRY',
        'A letterhead with this name already exists for this user/organization'
      );
    }
  }

  if (error instanceof Error) {
    throw new LetterheadError(
      'CREATE_FAILED',
      'Failed to create letterhead',
      error
    );
  }

  throw new LetterheadError(
    'CREATE_FAILED',
    'Failed to create letterhead'
  );
}

  }

  async findById(id: string): Promise<Letterhead | null> {
    try {
      const letterhead = await this.prisma.letterhead.findUnique({
        where: { id },
      });
      if (!letterhead) return null;
      return this.mapToDomain(letterhead);
    } catch (error) {
      throw new LetterheadError(
        'FIND_BY_ID_FAILED',
        `Failed to find letterhead with ID: ${id}`,
        error as Error
      );
    }
  }
 
  async findByIdtoInsert(id: string): Promise<Letterhead | null> {
    try {
      const letterhead = await this.prisma.letterhead.findUnique({
        where: { id },
      });
      if (!letterhead) return null;
      return this.mapToDomain(letterhead);
    } catch (error) {
      throw new LetterheadError(
        'FIND_BY_ID_FAILED',
        `Failed to find letterhead with ID: ${id}`,
        error as Error
      );
    }
  }

async findByName(name: string, userId: string, organizationId?: string | null): Promise<Letterhead | null> {
  try {
    // Build Prisma where clause with proper typing
    const where: Prisma.LetterheadWhereInput = {
      name,
      userId,
      deletedAt: null,
    };
    
    // Handle optional organizationId
    if (organizationId !== undefined) {
      where.organizationId = organizationId;
    }
    
    // Query the database
    const letterhead = await this.prisma.letterhead.findFirst({ where });
    
    // Map to domain entity if found
    return letterhead ? this.mapToDomain(letterhead) : null;
    
  } catch (error) {
    // Log error and return null
    console.error('Database error in findByName (returning null):', error);
    return null;
  }
}


async update(id: string, data: Partial<Letterhead>): Promise<Letterhead> {
  try {
    const { id: _, ...updateData } = data;

    const prismaData = {
      ...updateData,
      updatedAt: new Date(),
      marginSafeZone: updateData.marginSafeZone !== undefined
        ? (updateData.marginSafeZone as unknown as Prisma.InputJsonValue)
        : undefined,
    };

    const letterhead = await this.prisma.letterhead.update({
      where: { id },
      data: prismaData,
    });

    return this.mapToDomain(letterhead);

  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new LetterheadError(
          'NOT_FOUND',
          `Letterhead with ID ${id} not found`
        );
      }

      if (error.code === 'P2002') {
        throw new LetterheadError(
          'DUPLICATE_ENTRY',
          'A letterhead with this name already exists'
        );
      }
    }

    if (error instanceof Error) {
      throw new LetterheadError(
        'UPDATE_FAILED',
        `Failed to update letterhead with ID: ${id}`,
        error
      );
    }

    throw new LetterheadError(
      'UPDATE_FAILED',
      `Failed to update letterhead with ID: ${id}`
    );
  }
}


  async delete(id: string): Promise<void> {
    try {
      await this.prisma.letterhead.delete({
        where: { id },
      });
    } 
 catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new LetterheadError(
        'NOT_FOUND',
        `Letterhead with ID ${id} not found`
      );
    }
  }

  if (error instanceof Error) {
    throw new LetterheadError(
      'DELETE_FAILED',
      `Failed to delete letterhead with ID: ${id}`,
      error
    );
  }

  throw new LetterheadError(
    'DELETE_FAILED',
    `Failed to delete letterhead with ID: ${id}`
  );
}

  }

  async softDelete(id: string): Promise<Letterhead> {
    try {
      const letterhead = await this.prisma.letterhead.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          isPublic: false,
          updatedAt: new Date(),
        },
      });
      return this.mapToDomain(letterhead);
    } catch (error) {
      throw new LetterheadError(
        'SOFT_DELETE_FAILED',
        `Failed to soft delete letterhead with ID: ${id}`,
        error as Error
      );
    }
  }

  async restore(id: string): Promise<Letterhead> {
    try {
      const letterhead = await this.prisma.letterhead.update({
        where: { id },
        data: {
          deletedAt: null,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      return this.mapToDomain(letterhead);
    } catch (error) {
      throw new LetterheadError(
        'RESTORE_FAILED',
        `Failed to restore letterhead with ID: ${id}`,
        error as Error
      );
    }
  }

 
async findByUser(userId: string, organizationId?: string | null): Promise<Letterhead[]> {
  try {
    // Build typed Prisma where clause
    const where: Prisma.LetterheadWhereInput = {
      userId,
      deletedAt: null,
    };
    
    // Handle optional organizationId
    if (organizationId !== undefined) {
      where.organizationId = organizationId;
    }
    
    // Query the database
    const letterheads = await this.prisma.letterhead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    // Map all results to domain entities
    return letterheads.map(letterhead => this.mapToDomain(letterhead));
    
  } catch (error) {
    throw new LetterheadError(
      'FIND_BY_USER_FAILED',
      `Failed to find letterheads for user: ${userId}`,
      error as Error
    );
  }
}

  async findPublicById(id: string): Promise<Letterhead | null> {
    try {
      const letterhead = await this.prisma.letterhead.findFirst({
        where: {
          id,
          isPublic: true,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!letterhead) return null;
      return this.mapToDomain(letterhead);
    } catch (error) {
      throw new LetterheadError(
        'FIND_PUBLIC_BY_ID_FAILED',
        `Failed to find public letterhead with ID: ${id}`,
        error as Error
      );
    }
  }
 
 
    async findAll(
      filters?: LetterheadFilters | RepositoryLetterheadFilters, // Add union type
      pagination?: PaginationOptions
    ): Promise<{ items: Letterhead[]; total: number }> {
      try {
        console.log('=== Repository.findAll ===');
        console.log('Filters:', JSON.stringify(filters, null, 2));
        
        // Handle both filter types
        const where = this.buildWhereClause(filters);
        
        console.log('WHERE clause:', JSON.stringify(where, null, 2));
        
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        const skip = (page - 1) * limit;
        const orderBy = this.buildOrderBy(pagination);
        
        console.log('Executing query with:', { skip, limit, orderBy });
        
        // Explicitly select ALL fields
        const select = {
          id: true,
          userId: true,
          organizationId: true,
          name: true,
          description: true,
          category: true,
          paperSize: true,
          orientation: true,
          margins: true,
          safeZones: true,
          brandColors: true,
          primaryFont: true,
          secondaryFont: true,
         
          fileSize: true,
          fileType: true,
          mimeType: true,
          width: true,
          height: true,
          dpi: true,
          dimensionsUnit: true,
          backgroundColor: true,
          opacity: true,
          marginSafeZone: true,
          colorProfile: true,
          hasBleedArea: true,
          bleedAreaSize: true,
          isActive: true,
          isPublic: true,
          isSystem: true,
          usageCount: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
          publishedAt: true,
          deletedAt: true,
          version: true,
          parentId: true,
          ...(pagination?.securityOption !== 'none' && {
            filePath: true,
            thumbnailPath: true,
          }),
        };
        
        const [letterheads, total] = await Promise.all([
          this.prisma.letterhead.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            select, // Explicit select
          }),
          this.prisma.letterhead.count({ where }),
        ]);
        
        console.log('Database returned:', letterheads.length, 'items');
        
        // Debug each returned item
        letterheads.forEach((item, index) => {
          console.log(`DB Item ${index}:`, {
            id: item.id,
            name: item.name,
            isPublic: item.isPublic,
            isActive: item.isActive,
            deletedAt: item.deletedAt,
            paperSize: item.paperSize,
            orientation: item.orientation,
            hasMargins: !!item.margins,  
            hasSafeZones: !!item.safeZones, 
          });
        });
        
        return {
          items: letterheads.map(this.mapToDomain),
          total,
        };
      } catch (error) {
        throw new LetterheadError(
          'FIND_ALL_FAILED',
          'Failed to find letterheads',
          error as Error
        );
      }
    }
  
    // Update buildWhereClause to handle both filter types
    private buildWhereClause(
      filters?: LetterheadFilters | RepositoryLetterheadFilters
    ): Prisma.LetterheadWhereInput {
      console.log('Building WHERE clause from:', filters);
      
      if (!filters) {
        console.log('No filters, returning default WHERE');
        return { deletedAt: null };
      }
      
      // Handle RepositoryLetterheadFilters
      if (this.isRepositoryLetterheadFilters(filters)) {
        return this.buildWhereFromRepositoryFilters(filters);
      }
      
      // Handle LetterheadFilters (Prisma-style)
      return this.buildWhereFromPrismaFilters(filters as LetterheadFilters);
    }
  
    private isRepositoryLetterheadFilters(
      filters: any
    ): filters is RepositoryLetterheadFilters {
      return (
        filters &&
        (filters.userAccessConditions !== undefined ||
          filters.excludeDeleted !== undefined ||
          // Check for RepositoryLetterheadFilters specific fields
          (!filters.AND && !filters.OR && !filters.NOT))
      );
    }
  
    private buildWhereFromRepositoryFilters(
      filters: RepositoryLetterheadFilters
    ): Prisma.LetterheadWhereInput {
      const where: Prisma.LetterheadWhereInput = {};
      
      // Basic filters
      if (filters.userId !== undefined) {
        where.userId = filters.userId;
      }
      
      if (filters.organizationId !== undefined) {
        where.organizationId = filters.organizationId;
      }
      
      if (filters.category !== undefined) {
        where.category = filters.category;
      }
      
      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }
      
      if (filters.isPublic !== undefined) {
        where.isPublic = filters.isPublic;
      }
      
      if (filters.fileType !== undefined) {
        where.fileType = filters.fileType;
      }
      
      // Handle search
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
      
      // Handle userAccessConditions (complex OR logic)
      if (filters.userAccessConditions && filters.userAccessConditions.length > 0) {
        where.OR = filters.userAccessConditions.map(condition => {
          const conditionWhere: Prisma.LetterheadWhereInput = {};
          
          if (condition.userId !== undefined) {
            conditionWhere.userId = condition.userId;
          }
          
          if (condition.organizationId !== undefined) {
            conditionWhere.organizationId = condition.organizationId;
          }
          
          if (condition.isSystem !== undefined) {
            conditionWhere.isSystem = condition.isSystem;
          }
          
          if (condition.isPublic !== undefined) {
            conditionWhere.isPublic = condition.isPublic;
          }
          
          if (condition.isActive !== undefined) {
            conditionWhere.isActive = condition.isActive;
          }
          
          return conditionWhere;
        });
      }
      
      // Exclude deleted
      if (filters.excludeDeleted !== false) {
        where.deletedAt = null;
      }
      
      console.log('Built WHERE from repository filters:', JSON.stringify(where, null, 2));
      return where;
    }
  
    private buildWhereFromPrismaFilters(
      filters: LetterheadFilters
    ): Prisma.LetterheadWhereInput {
      // If it already has Prisma operators, return as-is
      const hasPrismaOperators = (
        filters.AND !== undefined ||
        filters.OR !== undefined ||
        filters.NOT !== undefined ||
        (filters.deletedAt && typeof filters.deletedAt === 'object') ||
        (filters.name && typeof filters.name === 'object' && 'contains' in filters.name) ||
        (filters.description && typeof filters.description === 'object' && 'contains' in filters.description)
      );
      
      if (hasPrismaOperators) {
        console.log('Filters already has Prisma operators, returning as-is');
        return filters as Prisma.LetterheadWhereInput;
      }
      
      // Convert simple filters
      const where: Prisma.LetterheadWhereInput = {};
      
      if (filters.userId !== undefined) where.userId = filters.userId;
      if (filters.organizationId !== undefined) where.organizationId = filters.organizationId;
      if (filters.category !== undefined) where.category = filters.category;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.isPublic !== undefined) where.isPublic = filters.isPublic;
      if (filters.fileType !== undefined) where.fileType = filters.fileType as LetterheadType;
      
      // Search handling
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
      
      // Exclude deleted unless explicitly told not to
      if (filters.excludeDeleted !== false) {
        where.deletedAt = null;
      }
      
      console.log('Built WHERE from Prisma filters:', JSON.stringify(where, null, 2));
      return where;
    }
  
    private buildOrderBy(
      pagination?: PaginationOptions
    ): Prisma.LetterheadOrderByWithRelationInput {
      const sortBy = pagination?.sortBy || 'createdAt';
      const sortOrder = pagination?.sortOrder || 'desc';
  
      return {
        [sortBy]: sortOrder,
      };
    }
  







    async findCategories(
      userId: string,
      organizationId?: string | null
    ): Promise<Array<{category: string, usageCount: number}>> {
      try {
        const where: Prisma.LetterheadWhereInput = {
          userId,
          deletedAt: null,
          category: { not: null },
          OR: [
            { organizationId: null },
            ...(organizationId ? [{ organizationId }] : [])
          ]
        };
    
        // Get letterheads with their category and usageCount
        const letterheads = await this.prisma.letterhead.findMany({
          where,
          select: { 
            category: true,
            usageCount: true
          },
          orderBy: { 
            category: 'asc'
          }
        });
    
        // Aggregate usage counts by category
        const categoryMap = new Map<string, number>();
        
        letterheads.forEach(l => {
          if (l.category && l.category.trim() !== '') {
            const category = l.category.trim();
            const currentTotal = categoryMap.get(category) || 0;
            categoryMap.set(category, currentTotal + (l.usageCount || 0));
          }
        });
    
        // Convert to array of objects
        const result = Array.from(categoryMap.entries())
          .map(([category, usageCount]) => ({ 
            category, 
            usageCount 
          }))
          .sort((a, b) => b.usageCount - a.usageCount || a.category.localeCompare(b.category));
    
        return result;
    
      } catch (error) {
        console.error('Error in findCategories:', error);
        throw new LetterheadError(
          'FIND_CATEGORIES_FAILED',
          `Failed to find categories for user: ${userId}`,
          error as Error
        );
      }
    }





   

  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.letterhead.count({
        where: { id, deletedAt: null },
      });
      return count > 0;
    } catch (error) {
      throw new LetterheadError(
        'EXISTS_FAILED',
        `Failed to check if letterhead exists: ${id}`,
        error as Error
      );
    }
  }

  async count(filters?: LetterheadFilters): Promise<number> {
    try {
      const where = this.buildWhereClause(filters);
      return await this.prisma.letterhead.count({ where });
    } catch (error) {
      throw new LetterheadError(
        'COUNT_FAILED',
        'Failed to count letterheads',
        error as Error
      );
    }
  }

  async getStats(
    userId: string,
    organizationId?: string | null
  ): Promise<LetterheadStats> {
    try {
      // Use the SAME logic as findCategories
      const where: Prisma.LetterheadWhereInput = {
        userId,
        deletedAt: null,
        OR: [
          { organizationId: null },
          ...(organizationId ? [{ organizationId }] : [])
        ]
      };
  
      console.log('Stats where clause:', JSON.stringify(where, null, 2));
  
      const [totalCount, activeCount, publicCount, usageStats] = await Promise.all([
        this.prisma.letterhead.count({ where }),
        this.prisma.letterhead.count({ where: { ...where, isActive: true } }),
        this.prisma.letterhead.count({ where: { ...where, isPublic: true } }),
        this.prisma.letterhead.aggregate({
          where,
          _sum: { usageCount: true },
          _avg: { usageCount: true },
        }),
      ]);
  
      console.log('Count results:', { totalCount, activeCount, publicCount });
      console.log('Usage stats:', usageStats);
  
      const fileTypeStats = await this.prisma.letterhead.groupBy({
        where,
        by: ['fileType'],
        _count: { fileType: true },
      });
  
      console.log('File type stats:', fileTypeStats);
  
      return {
        total: totalCount,
        active: activeCount,
        public: publicCount,
        totalUsage: usageStats._sum.usageCount || 0,
        avgUsage: usageStats._avg.usageCount || 0,
        fileTypes: fileTypeStats.map(stat => ({
          type: stat.fileType,
          count: stat._count.fileType,
        })),
      };
    } catch (error) {
      console.error('Error in getStats:', error);
      throw new LetterheadError(
        'GET_STATS_FAILED',
        'Failed to get letterhead statistics',
        error as Error
      );
    }
  }


  async incrementUsageCount(id: string): Promise<void> {
    try {
      await this.prisma.letterhead.update({
        where: { id },
        data: {
          usageCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      // Don't throw - usage tracking is not critical
      console.error('Failed to increment usage count:', error);
    }
  }

 
 
 
 
  private mapToDomain(prismaLetterhead: any): Letterhead {
    // Parse JSON fields safely
    const parseJsonField = (field: any) => {
      if (!field) return null;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return null;
        }
      }
      return field;
    };

    return {
      id: prismaLetterhead.id,
      userId: prismaLetterhead.userId,
      organizationId: prismaLetterhead.organizationId,
      name: prismaLetterhead.name,
      on: prismaLetterhead.on ?? null,
      printQuality: prismaLetterhead.printQuality ?? null,
      description: prismaLetterhead.description,
      category: prismaLetterhead.category,
      paperSize: prismaLetterhead.paperSize || 'A4',
      orientation: prismaLetterhead.orientation || 'PORTRAIT',
      margins: parseJsonField(prismaLetterhead.margins) || { 
        top: 57.6, right: 18, bottom: 36, left: 18 
      },
      safeZones: parseJsonField(prismaLetterhead.safeZones) || {
        header: { top: 0, bottom: 0, left: 0, right: 0 },
        footer: { top: 0, bottom: 0, left: 0, right: 0 }
      },
      brandColors: prismaLetterhead.brandColors || [],
      primaryFont: prismaLetterhead.primaryFont || null,
      secondaryFont: prismaLetterhead.secondaryFont || null,
       filePath: prismaLetterhead.filePath || null,
        thumbnailPath: prismaLetterhead.thumbnailPath || null,
      fileSize: prismaLetterhead.fileSize,
      fileType: prismaLetterhead.fileType as LetterheadType,
      mimeType: prismaLetterhead.mimeType,
      width: prismaLetterhead.width,
      height: prismaLetterhead.height,
      dpi: prismaLetterhead.dpi,
      dimensionsUnit: prismaLetterhead.dimensionsUnit || 'POINTS',
      backgroundColor: prismaLetterhead.backgroundColor,
      opacity: prismaLetterhead.opacity,
      marginSafeZone: parseJsonField(prismaLetterhead.marginSafeZone),
      colorProfile: prismaLetterhead.colorProfile || 'RGB',
      hasBleedArea: prismaLetterhead.hasBleedArea || false,
      bleedAreaSize: prismaLetterhead.bleedAreaSize,
      isActive: prismaLetterhead.isActive,
      isPublic: prismaLetterhead.isPublic,
      isSystem: prismaLetterhead.isSystem,
      usageCount: prismaLetterhead.usageCount || 0,
      lastUsedAt: prismaLetterhead.lastUsedAt,
      createdAt: prismaLetterhead.createdAt,
      updatedAt: prismaLetterhead.updatedAt,
      publishedAt: prismaLetterhead.publishedAt,
      deletedAt: prismaLetterhead.deletedAt,
      version: prismaLetterhead.version || '1.0.0',
      parentId: prismaLetterhead.parentId,
    };
  }
 


}