
  
import { PdfTemplateFilters, PdfTemplateRepository } from '@application/interfaces/pdf-template-repository.js';
import type { PdfTemplate } from '../../../domain/entities/pdf-template.entity.js';
import { PdfTemplateError } from '../../../domain/errors/pdf-template-error.js';
import { Fonts, HeaderFooterContent, ListPdfTemplatesFilters, Margins,   PdfTemplateConfig, PublicPdfTemplate, Styles, TemplateStatsSummary, ValidationRules, Variables } from '@application/dto/pdf-template.dto.js';
import { DatabaseQueryFilter, UserScopeFilter } from '@infrastructure/database/types/DatabaseQueryFilter.js';
import { PaginatedResult } from '@shared/types/pagination.js';

export class ListPdfTemplatesUseCase {
  constructor(private readonly pdfTemplateRepository: PdfTemplateRepository) {}

async execute(
  userId: string,
  filters: ListPdfTemplatesFilters = {},
  organizationId?: string | null
): Promise<PaginatedResult<PdfTemplate, TemplateStatsSummary>> {
  try {
    const normalizedFilters = this.normalizeFilters(filters);

   
    const queryFilters: PdfTemplateFilters = this.buildQueryFilters(
      userId, 
      normalizedFilters, 
      organizationId
    );

    const result = await this.pdfTemplateRepository.findAll(
      queryFilters,
      {
        page: normalizedFilters.page,
        limit: normalizedFilters.limit,
        sortBy: normalizedFilters.sortBy,
        sortOrder: normalizedFilters.sortOrder,
      }
    );

    const transformedItems = this.transformResults(result.items);

 
    const totalPages = Math.ceil(result.total / normalizedFilters.limit);
    const currentPage = normalizedFilters.page;
    
    return {
      items: transformedItems,
      pagination: {
        page: currentPage,
        limit: normalizedFilters.limit,
        total: result.total,
        totalPages: totalPages,
        hasNext: currentPage < totalPages,
        hasPrevious: currentPage > 1,
       
      },
       stats: this.calculateStats(transformedItems), 
    };

  } catch (error) {
    if (error instanceof PdfTemplateError) {
      throw error;
    }
    
    throw new PdfTemplateError(
      'LIST_FAILED',
      'Failed to list PDF templates',
      error as Error
    );
  }
}

  async executeCategories(
    userId: string,
    organizationId?: string | null
  ): Promise<string[]> {
    try {
      return await this.pdfTemplateRepository.findCategories(userId, organizationId);
    } catch (error) {
      throw new PdfTemplateError(
        'GET_CATEGORIES_FAILED',
        'Failed to get template categories',
        error as Error
      );
    }
  }

  async executePublic(filters: ListPdfTemplatesFilters = {}): Promise<PaginatedResult<PublicPdfTemplate, TemplateStatsSummary>> {
  try {
    const normalizedFilters = this.normalizeFilters(filters);

    // Fix 1: Convert to PdfTemplateFilters
    const queryFilters: PdfTemplateFilters = this.buildPublicQueryFilters(normalizedFilters);

    const result = await this.pdfTemplateRepository.findAll(
      queryFilters,
      {
        page: normalizedFilters.page,
        limit: normalizedFilters.limit,
        sortBy: normalizedFilters.sortBy,
        sortOrder: normalizedFilters.sortOrder,
      }
    );

    // Fix 2: Use PublicPdfTemplate type
    const sanitizedItems = result.items.map(template => 
      this.sanitizePublicTemplate(template)
    );

    // Fix 3: Return correct pagination structure
    const totalPages = Math.ceil(result.total / normalizedFilters.limit);
    const currentPage = normalizedFilters.page;
    
    return {
      items: sanitizedItems,
      pagination: {
        page: currentPage,
        limit: normalizedFilters.limit,
        total: result.total,
        totalPages: totalPages,
        hasNext: currentPage < totalPages,
        hasPrevious: currentPage > 1,
       
      },
       stats: this.calculatePublicStats(sanitizedItems),
    };

  } catch (error) {
    throw new PdfTemplateError(
      'LIST_PUBLIC_FAILED',
      'Failed to list public PDF templates',
      error as Error
    );
  }
}
private calculateStats(templates: PdfTemplate[]): TemplateStatsSummary {
  const stats: TemplateStatsSummary = {
    totalTemplates: templates.length,
    activeTemplates: templates.filter(t => t.isActive).length,
    publicTemplates: templates.filter(t => t.isPublic).length,
    byCategory: {},
  byBackgroundType: {
      NONE: 0,
      COLOR: 0,
      IMAGE: 0,
      PDF: 0,
      LETTERHEAD: 0,
    },
  };

  // Calculate category distribution
  templates.forEach(template => {
    if (template.category) {
      stats.byCategory[template.category] = (stats.byCategory[template.category] || 0) + 1;
    }

    // Calculate background type distribution
    stats.byBackgroundType[template.backgroundType] = 
      (stats.byBackgroundType[template.backgroundType] || 0) + 1;
  });

  return stats;
}
  private normalizeFilters(filters: ListPdfTemplatesFilters): {
    category?: string;
    isActive?: boolean;
    isPublic?: boolean;
    search?: string;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  } {
    return {
      category: filters.category,
      isActive: filters.isActive === 'true' ? true : 
                filters.isActive === 'false' ? false : undefined,
      isPublic: filters.isPublic === 'true' ? true : 
                filters.isPublic === 'false' ? false : undefined,
      search: filters.search,
      page: filters.page || 1,
      limit: Math.min(filters.limit || 20, 100),  
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'desc',
    };
  }

 private buildQueryFilters(
  userId: string,
  filters: ReturnType<typeof this.normalizeFilters>,
  organizationId?: string | null
): PdfTemplateFilters {
  const queryFilters: PdfTemplateFilters = {};
  
  // Set the user ID for access control
  queryFilters.userId = userId;
  
  // Set organization ID if provided
  if (organizationId) {
    queryFilters.organizationId = organizationId;
  }
  
  // Apply other filters directly
  if (filters.category) {
    queryFilters.category = filters.category;
  }
  
  if (filters.isActive !== undefined) {
    queryFilters.isActive = filters.isActive;
  }
  
  if (filters.isPublic !== undefined) {
    queryFilters.isPublic = filters.isPublic;
  }
  
  if (filters.search) {
    queryFilters.search = filters.search;
  }
  
  // Always exclude deleted
  queryFilters.excludeDeleted = true;
  
  return queryFilters;
}
 
private calculatePublicStats(templates: PublicPdfTemplate[]): TemplateStatsSummary {
  const stats: TemplateStatsSummary = {
    totalTemplates: templates.length,
    activeTemplates: templates.length,  
    publicTemplates: templates.length,  
    byCategory: {},
   byBackgroundType: {
      NONE: 0,
      COLOR: 0,
      IMAGE: 0,
      PDF: 0,
      LETTERHEAD: 0,
    },
  };

  // Calculate category distribution
  templates.forEach(template => {
    if (template.category) {
      stats.byCategory[template.category] = (stats.byCategory[template.category] || 0) + 1;
    }

    // Calculate background type distribution
    stats.byBackgroundType[template.backgroundType] = 
      (stats.byBackgroundType[template.backgroundType] || 0) + 1;
  });

  return stats;
}
 private buildPublicQueryFilters(filters: ReturnType<typeof this.normalizeFilters>): PdfTemplateFilters {
  const queryFilters: PdfTemplateFilters = {
    isPublic: true,
    isActive: true,
    excludeDeleted: true,
  };

  // Add category filter
  if (filters.category) {
    queryFilters.category = filters.category;
  }

  // Add search
  if (filters.search) {
    queryFilters.search = filters.search;
  }

  return queryFilters;
}

private transformResults(templates: PdfTemplate[]): Array<PdfTemplate & { elementCount: number }> {
  return templates.map(template => {
    const transformed: PdfTemplate & { elementCount: number } = {
      ...template,
      elementCount: this.calculateElementCount(template.config),
    };
    
    return transformed;
  });
}

private calculateElementCount(config: unknown): number {
  if (!config || typeof config !== 'object' || config === null) {
    return 0;
  }
  
  const typedConfig = config as { pages?: Array<{ elements?: unknown[] }> };
  
  if (!typedConfig.pages || !Array.isArray(typedConfig.pages)) {
    return 0;
  }
  
  return typedConfig.pages.reduce((count: number, page: { elements?: unknown[] }) => {
    return count + (Array.isArray(page.elements) ? page.elements.length : 0);
  }, 0);
}

 
 
 
 private sanitizePublicTemplate(
  template: PdfTemplate
): PublicPdfTemplate {
  return {
    id: template.id,

    name: template.name,
    title: template.title,
    description: template.description,
    category: template.category,
    tags: template.tags,

    config: template.config as PdfTemplateConfig,
    variables: template.variables as Variables | null,
    defaultData: template.defaultData as Record<string, unknown> | null,
    validationRules: template.validationRules as ValidationRules | null,

    pageSize: template.pageSize,
    orientation: template.orientation,
    margins: template.margins as Margins | null,
    fonts: template.fonts as Fonts | null,
    styles: template.styles as Styles | null,

    backgroundType: template.backgroundType,
    backgroundUrl: template.backgroundUrl,
    backgroundColor: template.backgroundColor,
    opacity: template.opacity,

    headerContent: template.headerContent as HeaderFooterContent | null,
    footerContent: template.footerContent as HeaderFooterContent | null,

    version: template.version,
    isActive: template.isActive,
    isPublic: template.isPublic,

    thumbnailUrl: template.thumbnailUrl,
    estimatedPages: template.estimatedPages,

    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    publishedAt: template.publishedAt,
    letterheadId: template.letterheadId,
  };
}


 
 
}