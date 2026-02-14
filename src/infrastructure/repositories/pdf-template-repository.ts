
import { Prisma, PrismaClient } from '@prisma/client';
import type { PdfTemplate as PrismaPdfTemplate } from '@prisma/client';
import type { 
  PdfTemplateRepository,
 
  PdfTemplateFilters,
 
} from '../../application/interfaces/pdf-template-repository.js';
import type { PdfTemplate } from '../../domain/entities/pdf-template.entity.js';
 
import { PdfTemplateError } from '../../domain/errors/pdf-template-error.js';
import { ClonePdfTemplateData, CreatePdfTemplateData, Fonts, HeaderFooterContent, JsonValue, Margins, PageSize, PdfTemplateConfig, Styles, ValidationRules, Variables } from '@application/dto/pdf-template.dto.js';
 
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PaginationOptions } from '@shared/types/pagination.js';
 
export class PrismaPdfTemplateRepository implements PdfTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePdfTemplateData): Promise<PdfTemplate> {
    try {
      const template = await this.prisma.pdfTemplate.create({
        data: {
          userId: data.userId,
          organizationId: data.organizationId,
          name: data.name,
          title: data.title,
          description: data.description,
          category: data.category,
          tags: data.tags || [],
          config: this.toJsonValue(data.config) ?? Prisma.JsonNull,
          variables: this.toJsonValue(data.variables) ?? Prisma.JsonNull,
          defaultData: this.toJsonValue(data.defaultData) ?? Prisma.JsonNull,
          validationRules: this.toJsonValue(data.validationRules) ?? Prisma.JsonNull,
          pageSize: data.pageSize || 'A4',
          orientation: data.orientation || 'PORTRAIT',
          margins: this.toJsonValue(data.margins) ?? Prisma.JsonNull,
          fonts: this.toJsonValue(data.fonts) ?? Prisma.JsonNull,
          styles: this.toJsonValue(data.styles) ?? Prisma.JsonNull,
          backgroundType: data.backgroundType || 'NONE',
          backgroundUrl: data.backgroundUrl,
          backgroundColor: data.backgroundColor,
          opacity: data.opacity || 1.0,
          headerContent: this.toJsonValue(data.headerContent as HeaderFooterContent | null) ?? Prisma.JsonNull,
          footerContent: this.toJsonValue(data.footerContent as HeaderFooterContent | null) ?? Prisma.JsonNull,
          version: data.version || '1.0.0',
          isActive: data.isActive ?? true,
          isPublic: data.isPublic ?? false,
          isSystem: data.isSystem ?? false,
          thumbnailUrl: data.thumbnailUrl,
          estimatedPages: data.estimatedPages,
          publishedAt: data.publishedAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });


      await this.prisma.pdfTemplateStats.create({
        data: {
          templateId: template.id,
          viewCount: 0,
          generationCount: 0,
          previewCount: 0,
          downloadCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return this.mapToDomain(template);
    } 
  catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new PdfTemplateError(
        'DUPLICATE_ENTRY',
        'A template with this name already exists for this user/organization'
      );
    }
  }

  if (error instanceof Error) {
    throw new PdfTemplateError(
      'CREATE_FAILED',
      'Failed to create PDF template',
      error
    );
  }

  throw new PdfTemplateError(
    'CREATE_FAILED',
    'Failed to create PDF template'
  );
}

  }

  async findById(id: string): Promise<PdfTemplate | null> {
    try {
      const template = await this.prisma.pdfTemplate.findUnique({
        where: { id },
      });
      if (!template) return null;
      return this.mapToDomain(template);
    } catch (error) {
      throw new PdfTemplateError(
        'FIND_BY_ID_FAILED',
        `Failed to find PDF template with ID: ${id}`,
        error as Error
      );
    }
  }
 

 
async findByName(
  name: string,
  userId: string,
  organizationId?: string | null
): Promise<PdfTemplate | null> {
  try {
    const where: Prisma.PdfTemplateWhereInput = {
      name,
      userId,
      deletedAt: null,
      ...(organizationId !== undefined ? { organizationId } : {}),
    };

    const template = await this.prisma.pdfTemplate.findFirst({ where });
    if (!template) return null;
    return this.mapToDomain(template);
  } catch (error) {
    throw new PdfTemplateError(
      'FIND_BY_NAME_FAILED',
      `Failed to find PDF template with name: ${name}`,
      error instanceof Error ? error : undefined
    );
  }
}


 
async update(id: string, data: Partial<PdfTemplate>): Promise<PdfTemplate> {
  try {
    const { id: _, ...rest } = data;

 
    const updateData: Prisma.PdfTemplateUpdateInput = {
      updatedAt: new Date(),
      ...(rest.name && { name: rest.name }),
      ...(rest.title && { title: rest.title }),
      ...(rest.description !== undefined && { description: rest.description }),
      ...(rest.category !== undefined && { category: rest.category }),
      ...(rest.tags && { tags: rest.tags }),
      ...(rest.config && { config: this.toJsonValue(rest.config as PdfTemplateConfig) }),
      ...(rest.variables && { variables: this.toJsonValue(rest.variables as Variables) }),
      ...(rest.defaultData && { defaultData: this.toJsonValue(rest.defaultData) }),
      ...(rest.validationRules && { validationRules: this.toJsonValue(rest.validationRules) }),
      ...(rest.pageSize && { pageSize: rest.pageSize as PageSize }),
      ...(rest.orientation && { orientation: rest.orientation }),
      ...(rest.margins && { margins: this.toJsonValue(rest.margins as Margins) }),
      ...(rest.fonts && { fonts: this.toJsonValue(rest.fonts as Fonts) }),
      ...(rest.styles && { styles: this.toJsonValue(rest.styles as Styles) }),
      ...(rest.backgroundType && { backgroundType: rest.backgroundType }),
      ...(rest.backgroundUrl !== undefined && { backgroundUrl: rest.backgroundUrl }),
      ...(rest.backgroundColor !== undefined && { backgroundColor: rest.backgroundColor }),
      ...(rest.opacity !== undefined && { opacity: rest.opacity }),
      ...(rest.headerContent && { headerContent: this.toJsonValue(rest.headerContent as HeaderFooterContent) }),
      ...(rest.footerContent && { footerContent: this.toJsonValue(rest.footerContent as HeaderFooterContent) }),
      ...(rest.isActive !== undefined && { isActive: rest.isActive }),
      ...(rest.isPublic !== undefined && { isPublic: rest.isPublic }),
      ...(rest.thumbnailUrl !== undefined && { thumbnailUrl: rest.thumbnailUrl }),
      ...(rest.estimatedPages !== undefined && { estimatedPages: rest.estimatedPages }),
      ...(rest.publishedAt !== undefined && { publishedAt: rest.publishedAt }),
      ...(rest.letterheadId !== undefined && { letterheadId: rest.letterheadId }),
    };

    const template = await this.prisma.pdfTemplate.update({
      where: { id },
      data: updateData,
    });

    return this.mapToDomain(template);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new PdfTemplateError('NOT_FOUND', `PDF template with ID ${id} not found`);
    }

    throw new PdfTemplateError(
      'UPDATE_FAILED',
      `Failed to update PDF template with ID: ${id}`,
      error instanceof Error ? error : undefined
    );
  }
}


  async delete(id: string): Promise<void> {
    try {
      await this.prisma.pdfTemplate.delete({
        where: { id },
      });
    } 
    catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new PdfTemplateError(
        'NOT_FOUND',
        `PDF template with ID ${id} not found`
      );
    }
  }

  if (error instanceof Error) {
    throw new PdfTemplateError(
      'DELETE_FAILED',
      `Failed to delete PDF template with ID: ${id}`,
      error
    );
  }

  throw new PdfTemplateError(
    'DELETE_FAILED',
    `Failed to delete PDF template with ID: ${id}`
  );
}

  }

  async softDelete(id: string): Promise<PdfTemplate> {
    try {
      const template = await this.prisma.pdfTemplate.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          isPublic: false,
          updatedAt: new Date(),
        },
      });
      return this.mapToDomain(template);
    } catch (error) {
      throw new PdfTemplateError(
        'SOFT_DELETE_FAILED',
        `Failed to soft delete PDF template with ID: ${id}`,
        error as Error
      );
    }
  }

  async restore(id: string): Promise<PdfTemplate> {
    try {
      const template = await this.prisma.pdfTemplate.update({
        where: { id },
        data: {
          deletedAt: null,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      return this.mapToDomain(template);
    } catch (error) {
      throw new PdfTemplateError(
        'RESTORE_FAILED',
        `Failed to restore PDF template with ID: ${id}`,
        error as Error
      );
    }
  }

 
async findByUser(userId: string, organizationId?: string | null): Promise<PdfTemplate[]> {
  try {
    const where: Prisma.PdfTemplateWhereInput = {
      userId,
      deletedAt: null,
      ...(organizationId !== undefined ? { organizationId } : {}),
    };

    const templates = await this.prisma.pdfTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return templates.map(this.mapToDomain);
  } catch (error) {
    throw new PdfTemplateError(
      'FIND_BY_USER_FAILED',
      `Failed to find PDF templates for user: ${userId}`,
      error instanceof Error ? error : undefined
    );
  }
}

  async findPublicById(id: string): Promise<PdfTemplate | null> {
    try {
      const template = await this.prisma.pdfTemplate.findFirst({
        where: {
          id,
          isPublic: true,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!template) return null;
      return this.mapToDomain(template);
    } catch (error) {
      throw new PdfTemplateError(
        'FIND_PUBLIC_BY_ID_FAILED',
        `Failed to find public PDF template with ID: ${id}`,
        error as Error
      );
    }
  }

  async findAll(
    filters?: PdfTemplateFilters,
    pagination?: PaginationOptions
  ): Promise<{ items: PdfTemplate[]; total: number }> {
    try {
      const where = this.buildWhereClause(filters);
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const skip = (page - 1) * limit;
      const orderBy = this.buildOrderBy(pagination);

      const [templates, total] = await Promise.all([
        this.prisma.pdfTemplate.findMany({
          where,
          skip,
          take: limit,
          orderBy,
        }),
        this.prisma.pdfTemplate.count({ where }),
      ]);

      return {
        items: templates.map(this.mapToDomain),
        total,
      };
    } catch (error) {
      throw new PdfTemplateError(
        'FIND_ALL_FAILED',
        'Failed to find PDF templates',
        error as Error
      );
    }
  }
 
async findCategories(
  userId: string,
  organizationId?: string | null
): Promise<string[]> {
  try {
    const where: Prisma.PdfTemplateWhereInput = {
      userId,
      deletedAt: null,
      category: { not: null },
    };

    if (organizationId !== undefined) {
      where.organizationId = organizationId;
    }

    const categories = await this.prisma.pdfTemplate.findMany({
      where,
      select: { category: true },
      distinct: ['category'],
    });

    return categories
      .map((c: { category: string | null }) => c.category)
      .filter((c): c is string => c !== null);
  } catch (error) {
    throw new PdfTemplateError(
      'FIND_CATEGORIES_FAILED',
      `Failed to find categories for user: ${userId}`,
      error instanceof Error ? error : undefined
    );
  }
}


  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.pdfTemplate.count({
        where: { id, deletedAt: null },
      });
      return count > 0;
    } catch (error) {
      throw new PdfTemplateError(
        'EXISTS_FAILED',
        `Failed to check if PDF template exists: ${id}`,
        error as Error
      );
    }
  }

  async count(filters?: PdfTemplateFilters): Promise<number> {
    try {
      const where = this.buildWhereClause(filters);
      return await this.prisma.pdfTemplate.count({ where });
    } catch (error) {
      throw new PdfTemplateError(
        'COUNT_FAILED',
        'Failed to count PDF templates',
        error as Error
      );
    }
  }

  async incrementViewCount(templateId: string): Promise<void> {
    try {
      await this.prisma.pdfTemplateStats.update({
        where: { templateId },
        data: {
          viewCount: { increment: 1 },
          lastViewedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {

      console.error('Failed to increment view count:', error);
    }
  }

toJsonValue<T>(value: T | null | undefined): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
 async clone(existingTemplate: PdfTemplate, newData: CreatePdfTemplateData): Promise<PdfTemplate> {
  console.log('Clone Data Received:', JSON.stringify(newData, null, 2));
  

  if (!newData.name) {
    console.error('ERROR: Template name is missing or empty:', newData.name);
    throw new Error('Template name is required for cloning');
  }   
  
const prismaData: Prisma.PdfTemplateCreateInput = {
  ...newData,
  config: this.toJsonValue(newData.config) ?? Prisma.JsonNull,
  variables: this.toJsonValue(newData.variables) ?? Prisma.JsonNull,
  defaultData: this.toJsonValue(newData.defaultData) ?? Prisma.JsonNull,
  validationRules: this.toJsonValue(newData.validationRules) ?? Prisma.JsonNull,
  fonts: this.toJsonValue(newData.fonts) ?? Prisma.JsonNull,
  styles: this.toJsonValue(newData.styles) ?? Prisma.JsonNull,
  margins: this.toJsonValue(newData.margins) ?? Prisma.JsonNull,
  headerContent: this.toJsonValue(newData.headerContent as HeaderFooterContent | null) ?? Prisma.JsonNull,
  footerContent: this.toJsonValue(newData.footerContent as HeaderFooterContent | null) ?? Prisma.JsonNull,
  letterhead: newData.letterheadId ? { connect: { id: newData.letterheadId } } : undefined,
  description: newData.description ?? undefined,
  category: newData.category ?? undefined,
  backgroundUrl: newData.backgroundUrl ?? undefined,
  backgroundColor: newData.backgroundColor ?? undefined,
  opacity: newData.opacity ?? undefined,
  estimatedPages: newData.estimatedPages ?? undefined,
  publishedAt: newData.publishedAt ?? undefined,
};

const created = await this.prisma.pdfTemplate.create({
  data: prismaData,
});

  await this.prisma.pdfTemplateStats.create({
    data: {
      templateId: created.id,
      viewCount: 0,
      generationCount: 0,
      previewCount: 0,
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return this.mapToDomain(created);
}
  










  async incrementGenerationCount(templateId: string): Promise<void> {
    try {
      await this.prisma.pdfTemplateStats.update({
        where: { templateId },
        data: {
          generationCount: { increment: 1 },
          lastGeneratedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to increment generation count:', error);
    }
  }

  async incrementPreviewCount(templateId: string): Promise<void> {
    try {
      await this.prisma.pdfTemplateStats.update({
        where: { templateId },
        data: {
          previewCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to increment preview count:', error);
    }
  }

  async incrementDownloadCount(templateId: string): Promise<void> {
    try {
      await this.prisma.pdfTemplateStats.update({
        where: { templateId },
        data: {
          downloadCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to increment download count:', error);
    }
  }

 
 private buildWhereClause(filters?: PdfTemplateFilters): Prisma.PdfTemplateWhereInput {
  const where: Prisma.PdfTemplateWhereInput = {
    deletedAt: null, // Always exclude deleted by default
  };

  // Build access control OR conditions
  const accessConditions: Prisma.PdfTemplateWhereInput[] = [];

  // User's own templates
  if (filters?.userId) {
    accessConditions.push({ userId: filters.userId });
  }

  // Organization templates
  if (filters?.organizationId) {
    accessConditions.push({ organizationId: filters.organizationId });
  }

  // Public templates (only include if not explicitly filtering for isPublic=false)
  if (filters?.isPublic !== false) {
    accessConditions.push({ isPublic: true, isActive: true });
  }

  // System templates
  accessConditions.push({ isSystem: true, isActive: true });

  // If we have access conditions, apply them
  if (accessConditions.length > 0) {
    where.OR = accessConditions;
  }

  // Now apply the additional filters (these apply to ALL access conditions)
  // We need to restructure the query if we have both OR conditions and other filters
  const additionalFilters: Prisma.PdfTemplateWhereInput = {};

  if (filters?.category) {
    additionalFilters.category = filters.category;
  }
  
  if (filters?.isActive !== undefined) {
    additionalFilters.isActive = filters.isActive;
  }
  
  if (filters?.isPublic !== undefined) {
    additionalFilters.isPublic = filters.isPublic;
  }

  // If we have additional filters AND OR conditions, we need to restructure
  if (Object.keys(additionalFilters).length > 0 && where.OR) {
    // Create a new structure: where.AND = [additionalFilters, { OR: accessConditions }]
    const newWhere: Prisma.PdfTemplateWhereInput = {
      AND: [
        additionalFilters,
        { OR: where.OR }
      ],
      deletedAt: null,
    };
    
    return newWhere;
  }

  // If no OR conditions or no additional filters, just merge
  if (Object.keys(additionalFilters).length > 0) {
    Object.assign(where, additionalFilters);
  }

  // Handle search separately - it needs to be combined with AND
  if (filters?.search) {
    const searchCondition: Prisma.PdfTemplateWhereInput = {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
        { title: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
        { description: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
        { tags: { has: filters.search } },
      ]
    };

    // If we already have an AND clause, handle it properly
    if (where.AND && Array.isArray(where.AND)) {
      // Type guard to ensure AND is an array
      where.AND = [...where.AND, searchCondition];
    } else if (where.AND && !Array.isArray(where.AND)) {
      // If AND is not an array but an object, convert it
      where.AND = [where.AND, searchCondition];
    } else {
      // Create a new AND clause with existing conditions and search
      const existingWhere = { ...where };
      // Remove OR from existingWhere to avoid duplication
      delete existingWhere.OR;
      
      const newWhere: Prisma.PdfTemplateWhereInput = {
        AND: [
          existingWhere,
          searchCondition
        ]
      };
      
      // Clear the old where conditions and assign new structure
     (Object.keys(where) as Array<keyof Prisma.PdfTemplateWhereInput>).forEach(key => {
  delete where[key];
});
      
      Object.assign(where, newWhere);
    }
  }

  return where;
}


  private buildOrderBy(pagination?: PaginationOptions): Record<string, 'asc' | 'desc'> {
  const sortBy = pagination?.sortBy || 'createdAt';
  const sortOrder: 'asc' | 'desc' = pagination?.sortOrder || 'desc';
  const orderBy: Record<string, 'asc' | 'desc'> = {};
  orderBy[sortBy] = sortOrder;
  return orderBy;
}

 
 
private mapToDomain(prismaTemplate: PrismaPdfTemplate): PdfTemplate {
  return {
    id: prismaTemplate.id,
    userId: prismaTemplate.userId,
    organizationId: prismaTemplate.organizationId,
    name: prismaTemplate.name,
    title: prismaTemplate.title,
    description: prismaTemplate.description,
    category: prismaTemplate.category,
    tags: prismaTemplate.tags ?? [],
    config: prismaTemplate.config as unknown as PdfTemplateConfig,
    variables: prismaTemplate.variables as unknown as Variables | null,
    defaultData: prismaTemplate.defaultData as Record<string, unknown> | null,
    validationRules: prismaTemplate.validationRules as unknown as ValidationRules | null,
    pageSize: prismaTemplate.pageSize,
    orientation: prismaTemplate.orientation,
    margins: prismaTemplate.margins as unknown as Margins | null,
    fonts: prismaTemplate.fonts as unknown as Fonts | null,
    styles: prismaTemplate.styles as unknown as Styles | null,
    backgroundType: prismaTemplate.backgroundType,
    backgroundUrl: prismaTemplate.backgroundUrl,
    backgroundColor: prismaTemplate.backgroundColor,
    opacity: prismaTemplate.opacity,
    headerContent: prismaTemplate.headerContent as unknown as HeaderFooterContent | null,
    footerContent: prismaTemplate.footerContent as unknown as HeaderFooterContent | null,
    version: prismaTemplate.version,
    isActive: prismaTemplate.isActive,
    isPublic: prismaTemplate.isPublic,
    isSystem: prismaTemplate.isSystem,
    thumbnailUrl: prismaTemplate.thumbnailUrl,
    estimatedPages: prismaTemplate.estimatedPages,
    letterheadId: prismaTemplate.letterheadId ?? null,
    createdAt: prismaTemplate.createdAt,
    updatedAt: prismaTemplate.updatedAt,
    publishedAt: prismaTemplate.publishedAt,
    deletedAt: prismaTemplate.deletedAt,
  };
}




}