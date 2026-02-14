 
import { DocumentStatus, Prisma, PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { DocumentAccessAction, PdfDocument as PrismaPdfDocument } from '@prisma/client';

import type { 
 
  CreatePdfDocumentData,
  PdfDocumentFilters,
 
  IPdfDocumentRepository,
  DocumentStats,
  DocumentStatsFilters,
  PdfDocumentSearchOptions,
  PdfDocumentSearchResult,
  PdfDocumentWithRelations,
  StorageFileInfo,
  UpdatePdfDocumentData
} from '../../application/interfaces/pdf-document-repository.interface.js';
import type { PdfDocument  } from '../../domain/entities/pdf-document.entity.js';
 
import { PdfGenerationError } from '../../domain/errors/pdf-generation-error.js';
import { PdfMetadata, TemplateData, TemplateVariables } from '@application/dto/generate-pdf.dto.js';
import { PaginationOptions } from '@shared/types/pagination.js';
  
//
 
export class PrismaPdfDocumentRepository implements IPdfDocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePdfDocumentData): Promise<PdfDocument> {
    try {
      // Handle fileUrl - it can be string or StorageFileInfo object
      const fileUrl = this.extractFileUrl(data.fileUrl);
      
      // Convert TemplateData to Prisma JsonValue
      const dataJson = this.convertToJsonValue(data.data);
      const variablesJson = data.variables ? this.convertToJsonValue(data.variables) : Prisma.JsonNull;
      const metadataJson = data.metadata ? this.convertToJsonValue(data.metadata) : Prisma.JsonNull;

      const prismaData: Prisma.PdfDocumentCreateInput = {
        template: { connect: { id: data.templateId } },
        fileName: data.fileName,
        fileUrl: fileUrl,
        filePath: data.filePath ?? null,
        fileSize: data.fileSize,
        fileHash: data.fileHash ?? null,
        mimeType: data.mimeType ?? 'application/pdf',
        pageCount: data.pageCount,
        data: dataJson,
        variables: variablesJson,
        metadata: metadataJson,
        status: data.status ?? 'GENERATED',
        isPreview: data.isPreview ?? false,
        expiresAt: data.expiresAt ?? null,
        errorMessage: data.errorMessage ?? null,
        generationTime: data.generationTime ?? null,
        fileSizeBeforeCompression: data.fileSizeBeforeCompression ?? null,
        compressionRatio: data.compressionRatio ?? null,
        generatedBy: data.generatedBy ?? null,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        referrer: data.referrer ?? null,
        createdAt: data.createdAt ?? new Date(),
        updatedAt: data.updatedAt ?? new Date(),
        accessedAt: data.accessedAt ?? null,
        deletedAt: data.deletedAt ?? null,
      };

      const document = await this.prisma.pdfDocument.create({
        data: prismaData,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      });

      return this.mapToDomain(document);
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            throw new PdfGenerationError(
              'DUPLICATE_ERROR',
              'PDF document with this identifier already exists'
            );
          case 'P2025':
            throw new PdfGenerationError(
              'TEMPLATE_NOT_FOUND',
              'Template not found'
            );
          default:
            throw new PdfGenerationError(
              'CREATE_FAILED',
              `Failed to create PDF document: ${error.message}`,
              error
            );
        }
      }
      throw new PdfGenerationError(
        'CREATE_FAILED',
        'Failed to create PDF document',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async findById(id: string): Promise<PdfDocument | null> {
    try {
      const document = await this.prisma.pdfDocument.findUnique({
        where: { id },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      });
      
      return document ? this.mapToDomain(document) : null;
    } catch (error: unknown) {
      throw new PdfGenerationError(
        'FIND_BY_ID_FAILED',
        `Failed to find PDF document with ID: ${id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async findByIdWithRelations(id: string): Promise<PdfDocumentWithRelations | null> {
    try {
      const document = await this.prisma.pdfDocument.findUnique({
        where: { id },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
              userId: true,
              organizationId: true,
              isPublic: true,
              isActive: true,
            },
          },
        },
      });
      
      if (!document) return null;
      
      const domainDocument = this.mapToDomain(document);
      
      // Build PdfDocumentWithRelations
      const documentWithRelations: PdfDocumentWithRelations = {
        ...domainDocument,
        user: undefined, // Would need separate query to get user info
        organization: undefined, // Would need separate query to get organization info
      };
      
      return documentWithRelations;
    } catch (error: unknown) {
      throw new PdfGenerationError(
        'FIND_BY_ID_FAILED',
        `Failed to find PDF document with ID: ${id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async findByUser(
    userId: string, 
    filters?: PdfDocumentFilters
  ): Promise<{ items: PdfDocument[]; total: number }> {
    try {
      const where = this.buildWhereClause({ ...filters, generatedBy: userId });
      
      const [documents, total] = await Promise.all([
        this.prisma.pdfDocument.findMany({
          where,
          include: {
            template: {
              select: {
                id: true,
                name: true,
                title: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.pdfDocument.count({ where }),
      ]);

      return {
        items: documents.map(this.mapToDomain),
        total,
      };
    } catch (error: unknown) {
      throw new PdfGenerationError(
        'FIND_BY_USER_FAILED',
        `Failed to find PDF documents for user: ${userId}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async findAll(
    filters?: PdfDocumentFilters,
    pagination?: PaginationOptions
  ): Promise<{ items: PdfDocument[]; total: number }> {
    try {
      const where = this.buildWhereClause(filters);
      const page = pagination?.page ?? 1;
      const limit = pagination?.limit ?? 20;
      const skip = (page - 1) * limit;
      const orderBy = this.buildOrderBy(pagination);

      const [documents, total] = await Promise.all([
        this.prisma.pdfDocument.findMany({
          where,
          include: {
            template: {
              select: {
                id: true,
                name: true,
                title: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy,
        }),
        this.prisma.pdfDocument.count({ where }),
      ]);

      return {
        items: documents.map(this.mapToDomain),
        total,
      };
    } catch (error: unknown) {
      throw new PdfGenerationError(
        'FIND_ALL_FAILED',
        'Failed to find PDF documents',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async update(id: string, data: UpdatePdfDocumentData): Promise<PdfDocument> {
    try {
      // Prepare update data
      const updateData: Prisma.PdfDocumentUpdateInput = {
        updatedAt: new Date(),
      };

      // Add optional fields if provided
      if (data.fileName !== undefined) updateData.fileName = data.fileName;
      if (data.fileUrl !== undefined) {
        updateData.fileUrl = this.extractFileUrl(data.fileUrl);
      }
      if (data.filePath !== undefined) updateData.filePath = data.filePath;
      if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;
      if (data.fileHash !== undefined) updateData.fileHash = data.fileHash;
      if (data.mimeType !== undefined) updateData.mimeType = data.mimeType;
      if (data.pageCount !== undefined) updateData.pageCount = data.pageCount;
      if (data.data !== undefined) updateData.data = this.convertToJsonValue(data.data);
      if (data.variables !== undefined) updateData.variables = data.variables ? this.convertToJsonValue(data.variables) : Prisma.JsonNull;
      if (data.metadata !== undefined) updateData.metadata = data.metadata ? this.convertToJsonValue(data.metadata) : Prisma.JsonNull;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.isPreview !== undefined) updateData.isPreview = data.isPreview;
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;
      if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
      if (data.generationTime !== undefined) updateData.generationTime = data.generationTime;
      if (data.fileSizeBeforeCompression !== undefined) updateData.fileSizeBeforeCompression = data.fileSizeBeforeCompression;
      if (data.compressionRatio !== undefined) updateData.compressionRatio = data.compressionRatio;
      if (data.generatedBy !== undefined) updateData.generatedBy = data.generatedBy;
      if (data.ipAddress !== undefined) updateData.ipAddress = data.ipAddress;
      if (data.userAgent !== undefined) updateData.userAgent = data.userAgent;
      if (data.referrer !== undefined) updateData.referrer = data.referrer;
      if (data.accessedAt !== undefined) updateData.accessedAt = data.accessedAt;
      if (data.deletedAt !== undefined) updateData.deletedAt = data.deletedAt;

      const document = await this.prisma.pdfDocument.update({
        where: { id },
        data: updateData,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      });

      return this.mapToDomain(document);
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new PdfGenerationError(
          'NOT_FOUND',
          `PDF document with ID ${id} not found`
        );
      }
      throw new PdfGenerationError(
        'UPDATE_FAILED',
        `Failed to update PDF document with ID: ${id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Delete related access logs first
      await this.prisma.pdfDocumentAccessLog.deleteMany({
        where: { documentId: id },
      });

      // Delete the document
      await this.prisma.pdfDocument.delete({
        where: { id },
      });
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new PdfGenerationError(
          'NOT_FOUND',
          `PDF document with ID ${id} not found`
        );
      }
      throw new PdfGenerationError(
        'DELETE_FAILED',
        `Failed to delete PDF document with ID: ${id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async softDelete(id: string): Promise<PdfDocument> {
    try {
      const document = await this.prisma.pdfDocument.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      });
      
      return this.mapToDomain(document);
    } catch (error: unknown) {
      throw new PdfGenerationError(
        'SOFT_DELETE_FAILED',
        `Failed to soft delete PDF document with ID: ${id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async restore(id: string): Promise<PdfDocument> {
    try {
      const document = await this.prisma.pdfDocument.update({
        where: { id },
        data: { 
          deletedAt: null,
          updatedAt: new Date(),
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      });
      
      return this.mapToDomain(document);
    } catch (error: unknown) {
      throw new PdfGenerationError(
        'RESTORE_FAILED',
        `Failed to restore PDF document with ID: ${id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async incrementAccessCount(id: string): Promise<void> {
    try {
      await this.prisma.pdfDocument.update({
        where: { id },
        data: {
          accessedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Log the access
      await this.logAccess(id, 'VIEW');
    } catch (error: unknown) {
      // Log error but don't throw - this is a non-critical operation
      console.error('Failed to increment access count:', error);
    }
  }

  async getStats(
    userId: string,
    filters?: DocumentStatsFilters
  ): Promise<DocumentStats> {
    try {
      const where = this.buildStatsWhereClause(userId, filters);
      
      const [
        totalCount,
        totalSize,
        previewCount,
        expiredPreviewCount,
        statusStats,
        templateStats,
        dailyStats
      ] = await Promise.all([
        // Total documents
        this.prisma.pdfDocument.count({ where }),
        
        // Total file size
        this.prisma.pdfDocument.aggregate({
          where,
          _sum: { fileSize: true },
        }),
        
        // Preview documents
        this.prisma.pdfDocument.count({
          where: { ...where, isPreview: true },
        }),
        
        // Expired previews
        this.prisma.pdfDocument.count({
          where: { 
            ...where, 
            isPreview: true,
            expiresAt: { lt: new Date() }
          },
        }),
        
        // Status statistics
        this.prisma.pdfDocument.groupBy({
          by: ['status'],
          where,
          _count: { id: true },
        }),
        
        // Template statistics
        this.prisma.pdfDocument.groupBy({
          by: ['templateId'],
          where,
          _count: { id: true },
          _sum: { fileSize: true },
        }),
        
        // Daily statistics
        this.getDailyStats(userId, filters),
      ]);

      // Calculate average file size
      const avgSize = totalCount > 0 ? (totalSize._sum.fileSize ?? 0) / totalCount : 0;

      // Convert status stats to Record<DocumentStatus, number>
      const byStatus = statusStats.reduce((acc, stat) => {
        acc[stat.status as DocumentStatus] = stat._count.id;
        return acc;
      }, {} as Record<DocumentStatus, number>);

      // Prepare template stats
      const byTemplate = await Promise.all(
        templateStats.map(async (stat) => {
          const template = await this.prisma.pdfTemplate.findUnique({
            where: { id: stat.templateId },
            select: { name: true }
          });
          
          return {
            templateId: stat.templateId,
            templateName: template?.name ?? 'Unknown',
            count: stat._count.id,
            totalSize: stat._sum.fileSize ?? 0,
          };
        })
      );

      return {
        totalDocuments: totalCount,
        totalSize: totalSize._sum.fileSize ?? 0,
        averageSize: avgSize,
        byStatus,
        byTemplate,
        byDate: dailyStats,
        previews: {
          total: previewCount,
          expired: expiredPreviewCount,
          active: previewCount - expiredPreviewCount,
        },
        recentActivity: await this.getRecentActivity(userId),
      };
    } catch (error: unknown) {
      throw new PdfGenerationError(
        'GET_STATS_FAILED',
        'Failed to get document statistics',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  
  async search(options: PdfDocumentSearchOptions): Promise<{ items: PdfDocumentSearchResult[]; total: number }> {
    try {
      const where: Prisma.PdfDocumentWhereInput = {
        deletedAt: null,
      };

      if (options.userId) where.generatedBy = options.userId;
      if (options.organizationId) {
        // This would need a join with templates
        where.template = { organizationId: options.organizationId };
      }
      if (options.templateId) where.templateId = options.templateId;

      // combine base where with optional text search into a single where object
      const findWhere: Prisma.PdfDocumentWhereInput = options.query ? {
        ...where,
        OR: [
          { fileName: { contains: options.query, mode: 'insensitive' } },
          { template: { name: { contains: options.query, mode: 'insensitive' } } },
          { template: { title: { contains: options.query, mode: 'insensitive' } } },
        ],
      } : where;

      const [documents, total] = await Promise.all([
        this.prisma.pdfDocument.findMany({
          where: findWhere,
          include: {
            template: {
              select: {
                id: true,
                name: true,
                title: true,
              },
            },
          },
          skip: options.offset ?? 0,
          take: options.limit ?? 20,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.pdfDocument.count({ where: findWhere }),
      ]);

      const items: PdfDocumentSearchResult[] = documents.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        templateName: doc.template?.name ?? 'Unknown',
        templateId: doc.templateId,
        createdAt: doc.createdAt,
        fileSize: doc.fileSize,
        pageCount: doc.pageCount,
        status: doc.status as DocumentStatus,
        // Score would require full-text search implementation
      }));

      return { items, total };
    } catch (error: unknown) {
      throw new PdfGenerationError(
        'SEARCH_FAILED',
        'Failed to search PDF documents',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Helper Methods

  private buildWhereClause(filters?: PdfDocumentFilters): Prisma.PdfDocumentWhereInput {
    const where: Prisma.PdfDocumentWhereInput = {};

    if (filters?.templateId) where.templateId = filters.templateId;
    if (filters?.generatedBy) where.generatedBy = filters.generatedBy;
    if (filters?.status) where.status = filters.status;
    if (filters?.isPreview !== undefined) where.isPreview = filters.isPreview;
    
    // Date filters
    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }
    
    // Search filter
    if (filters?.search) {
      where.OR = [
        { fileName: { contains: filters.search, mode: 'insensitive' } },
        { template: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
    
    // Deletion filter
    if (filters?.excludeDeleted !== false) {
      where.deletedAt = null;
    }
    if (filters?.includeDeleted === true) {
      delete where.deletedAt;
    }

    // File size filters
    if (filters?.minFileSize || filters?.maxFileSize) {
      where.fileSize = {};
      if (filters.minFileSize) where.fileSize.gte = filters.minFileSize;
      if (filters.maxFileSize) where.fileSize.lte = filters.maxFileSize;
    }

    return where;
  }

  private buildStatsWhereClause(
    userId: string, 
    filters?: DocumentStatsFilters
  ): Prisma.PdfDocumentWhereInput {
    const where: Prisma.PdfDocumentWhereInput = {
      generatedBy: userId,
      deletedAt: null,
    };

    if (filters?.templateId) where.templateId = filters.templateId;
    if (filters?.status) where.status = filters.status;
    if (filters?.isPreview !== undefined) where.isPreview = filters.isPreview;
    
    // Date range filter
    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }
    
    // Period filter
    if (filters?.period) {
      const periodDate = this.getPeriodStartDate(filters.period);
      where.createdAt = { gte: periodDate };
    }

    return where;
  }

  private buildOrderBy(pagination?: PaginationOptions): Prisma.PdfDocumentOrderByWithRelationInput {
    const sortBy = pagination?.sortBy ?? 'createdAt';
    const sortOrder = pagination?.sortOrder ?? 'desc';
    
    // Map sort field names to Prisma field names
    const fieldMap: Record<string, keyof Prisma.PdfDocumentOrderByWithRelationInput> = {
      fileName: 'fileName',
      fileSize: 'fileSize',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    };

    const field = fieldMap[sortBy] ?? 'createdAt';
    return { [field]: sortOrder };
  }

  private async getDailyStats(
    userId: string, 
    filters?: DocumentStatsFilters
  ): Promise<Array<{ date: string; count: number; totalSize: number }>> {
    const periodDate = filters?.period ? this.getPeriodStartDate(filters.period) : new Date(0);

    const dailyStats = await this.prisma.$queryRaw<
      Array<{ date: string; count: bigint; total_size: bigint }>
    >`
      SELECT 
        DATE("created_at") as date,
        COUNT(*)::bigint as count,
        SUM("file_size")::bigint as total_size
      FROM "pdfs"."pdf_documents"
      WHERE 
        "generated_by" = ${userId}::uuid
        AND "deleted_at" IS NULL
        AND "created_at" >= ${periodDate}
      GROUP BY DATE("created_at")
      ORDER BY date DESC
      LIMIT 30
    `;

    return dailyStats.map(stat => ({
      date: stat.date,
      count: Number(stat.count),
      totalSize: Number(stat.total_size),
    }));
  }

  private async getRecentActivity(
    userId: string
  ): Promise<Array<{ date: Date; action: 'created' | 'accessed' | 'deleted'; count: number }>> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activity = await this.prisma.$queryRaw<
      Array<{ date: string; action: string; count: bigint }>
    >`
      WITH activity_data AS (
        SELECT 
          DATE("created_at") as date,
          'created' as action
        FROM "pdfs"."pdf_documents"
        WHERE 
          "generated_by" = ${userId}::uuid
          AND "created_at" >= ${sevenDaysAgo}
        
        UNION ALL
        
        SELECT 
          DATE("accessed_at") as date,
          'accessed' as action
        FROM "pdfs"."pdf_documents"
        WHERE 
          "generated_by" = ${userId}::uuid
          AND "accessed_at" >= ${sevenDaysAgo}
          AND "accessed_at" IS NOT NULL
        
        UNION ALL
        
        SELECT 
          DATE("deleted_at") as date,
          'deleted' as action
        FROM "pdfs"."pdf_documents"
        WHERE 
          "generated_by" = ${userId}::uuid
          AND "deleted_at" >= ${sevenDaysAgo}
          AND "deleted_at" IS NOT NULL
      )
      SELECT 
        date,
        action,
        COUNT(*)::bigint as count
      FROM activity_data
      WHERE date IS NOT NULL
      GROUP BY date, action
      ORDER BY date DESC
    `;

    return activity.map(a => ({
      date: new Date(a.date),
      action: a.action as 'created' | 'accessed' | 'deleted',
      count: Number(a.count),
    }));
  }

  private getPeriodStartDate(period: DocumentStatsFilters['period']): Date {
    const now = new Date();
    switch (period) {
      case 'hour':  // Add this case
      return new Date(now.setDate(now.getDate() - 1));
      break;
      case 'day':
        return new Date(now.setDate(now.getDate() - 1));
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      case 'custom':
      default:
        return new Date(0); // All time
    }
  }

 private async logAccess(
  documentId: string,
  action: DocumentAccessAction 
): Promise<void> {
  try {
    await this.prisma.pdfDocumentAccessLog.create({
      data: {
        documentId,
        action,        // now type-safe
        createdAt: new Date(),
      },
    });
  } catch (error: unknown) {
    console.error('Failed to log access:', error);
  }
}


  private extractFileUrl(fileUrl: string | StorageFileInfo): string {
    if (typeof fileUrl === 'string') {
      return fileUrl;
    }
    // If it's a StorageFileInfo object, use the public URL or URL
    return fileUrl.publicUrl ?? fileUrl.url ?? JSON.stringify(fileUrl);
  }

  private convertToJsonValue(data: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (data === undefined || data === null) {
      return Prisma.JsonNull;
    }
    
    // Prisma handles Date objects automatically
    // For complex objects, ensure they're JSON-serializable
    return data as Prisma.InputJsonValue;
  }

  private mapToDomain(prismaDocument: PrismaPdfDocument): PdfDocument {
    return {
      id: prismaDocument.id,
      templateId: prismaDocument.templateId,
   // template: prismaDocument.template ?? undefined,
      fileName: prismaDocument.fileName,
      fileUrl: prismaDocument.fileUrl,
      filePath: prismaDocument.filePath,
      fileSize: prismaDocument.fileSize,
      fileHash: prismaDocument.fileHash,
      mimeType: prismaDocument.mimeType,
      pageCount: prismaDocument.pageCount,
      data: prismaDocument.data as TemplateData,
      variables: prismaDocument.variables as TemplateVariables | null,
      metadata: prismaDocument.metadata as PdfMetadata | null,
      status: prismaDocument.status,
      isPreview: prismaDocument.isPreview,
      expiresAt: prismaDocument.expiresAt,
      errorMessage: prismaDocument.errorMessage,
      generationTime: prismaDocument.generationTime,
      fileSizeBeforeCompression: prismaDocument.fileSizeBeforeCompression,
      compressionRatio: prismaDocument.compressionRatio,
      generatedBy: prismaDocument.generatedBy,
      ipAddress: prismaDocument.ipAddress,
      userAgent: prismaDocument.userAgent,
      referrer: prismaDocument.referrer,
      createdAt: prismaDocument.createdAt,
      updatedAt: prismaDocument.updatedAt,
      accessedAt: prismaDocument.accessedAt,
      deletedAt: prismaDocument.deletedAt,
    };
  }
}