   
import { PdfTemplateRepository } from '@application/interfaces/pdf-template-repository.js';
import type { PdfTemplate } from '../../../domain/entities/pdf-template.entity.js';
import { 
  PdfTemplateError, 
  PdfTemplateValidationError,
  PdfTemplateDuplicateError 
} from '../../../domain/errors/pdf-template-error.js';
import { CreatePdfTemplateData } from '@application/dto/pdf-template.dto.js';
import { TemplateConfig, TemplateElement, TemplatePage } from '@domain/pdf-template/templateConfig.js';

export class CreatePdfTemplateUseCase {
  constructor(private readonly pdfTemplateRepository: PdfTemplateRepository) {}

  async execute(
    userId: string, 
    data: CreatePdfTemplateData
  ): Promise<PdfTemplate> {
    try {
      // 1. Validate input data
      this.validateCreateData(data);

      // 2. Check for duplicate template name
      const existingTemplate = await this.pdfTemplateRepository.findByName(
        data.name,
        userId,
        data.organizationId || null
      );

      if (existingTemplate && !existingTemplate.deletedAt) {
        throw new PdfTemplateDuplicateError(
          data.name,
          userId,
          data.organizationId
        );
      }

      // 3. Validate template configuration
      this.validateTemplateConfig(data.config);

      // 4. Validate styling and layout
      this.validateStyling(data);

      // 5. Prepare template data with defaults
      const templateData = {
        ...data,
        userId,
        version: data.version || '1.0.0',
        isActive: data.isActive ?? true,
        isPublic: data.isPublic ?? false,
        isSystem: false,
        tags: data.tags || [],
        pageSize: data.pageSize || 'A4',
        orientation: data.orientation || 'PORTRAIT',
        backgroundType: data.backgroundType || 'NONE',
        opacity: data.opacity || 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: data.isPublic ? new Date() : null,
        deletedAt: null,
        estimatedPages: this.calculateEstimatedPages(data.config),
      };

      // 6. Create template
      const template = await this.pdfTemplateRepository.create(templateData);

      // 7. Log creation in audit trail
      await this.logTemplateCreation(template, userId);

      return template;

    } catch (error) {
      if (
        error instanceof PdfTemplateError ||
        error instanceof PdfTemplateValidationError ||
        error instanceof PdfTemplateDuplicateError
      ) {
        throw error;
      }
      
      throw new PdfTemplateError(
        'CREATE_FAILED',
        'Failed to create PDF template',
        error as Error
      );
    }
  }

  private validateCreateData(data: CreatePdfTemplateData): void {
    const errors: string[] = [];

    // Required fields
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Template name is required');
    } else if (data.name.length > 100) {
      errors.push('Template name must be 100 characters or less');
    }

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Template title is required');
    } else if (data.title.length > 200) {
      errors.push('Template title must be 200 characters or less');
    }

    if (!data.config || typeof data.config !== 'object') {
      errors.push('Template configuration is required');
    }

    // Category validation
    if (data.category && data.category.length > 50) {
      errors.push('Category must be 50 characters or less');
    }

    // Tags validation
    if (data.tags && data.tags.length > 10) {
      errors.push('Maximum 10 tags allowed');
    }
    
    if (data.tags) {
      for (const tag of data.tags) {
        if (tag.length > 30) {
          errors.push(`Tag "${tag}" must be 30 characters or less`);
        }
      }
    }

    // Version validation
    if (data.version && !/^\d+\.\d+\.\d+$/.test(data.version)) {
      errors.push('Version must follow semantic versioning (e.g., 1.0.0)');
    }

    if (errors.length > 0) {
      throw new PdfTemplateValidationError('INVALID_INPUT', errors);
    }
  }
 
 
private validateTemplateConfig(config: unknown): void {
  if (!config || typeof config !== 'object' || config === null) {
    throw new PdfTemplateValidationError('INVALID_CONFIG', [
      'Template config must be a valid object'
    ]);
  }

  const errors: string[] = [];
  const typedConfig = config as TemplateConfig;

  // Validate structure
  if (!typedConfig.pages || !Array.isArray(typedConfig.pages)) {
    errors.push('Config must contain a pages array');
  } else if (typedConfig.pages.length === 0) {
    errors.push('Config must contain at least one page');
  } else {
    // Validate each page
    typedConfig.pages.forEach((page: TemplatePage, pageIndex: number) => {
      if (!page.elements || !Array.isArray(page.elements)) {
        errors.push(`Page ${pageIndex + 1} must contain elements array`);
        return;
      }

      // Validate each element
      page.elements.forEach((element: TemplateElement, elementIndex: number) => {
        if (!element.type) {
          errors.push(`Page ${pageIndex + 1}, Element ${elementIndex + 1}: Type is required`);
        }
        
        if (!element.position || typeof element.position !== 'object') {
          errors.push(`Page ${pageIndex + 1}, Element ${elementIndex + 1}: Position is required`);
        } else {
          const { x, y, width, height } = element.position;
          if (x === undefined || y === undefined || width === undefined || height === undefined) {
            errors.push(`Page ${pageIndex + 1}, Element ${elementIndex + 1}: Position must include x, y, width, height`);
          }
        }
      });
    });
  }

  if (errors.length > 0) {
    throw new PdfTemplateValidationError('INVALID_CONFIG', errors);
  }
}

private validateStyling(data: CreatePdfTemplateData): void {
  const errors: string[] = [];

  // Validate margins with proper type
  if (data.margins) {
    const margins = data.margins;
    const marginKeys: Array<keyof typeof margins> = ['top', 'right', 'bottom', 'left'];
    
    for (const key of marginKeys) {
      const value = margins[key];
      if (value !== undefined && (typeof value !== 'number' || value < 0)) {
        errors.push(`Margin ${key} must be a positive number`);
      }
    }
  }

  if (errors.length > 0) {
    throw new PdfTemplateValidationError('INVALID_STYLING', errors);
  }
}

private calculateEstimatedPages(config: unknown): number {
  if (!config || typeof config !== 'object' || config === null) {
    return 1;
  }
  
  const typedConfig = config as TemplateConfig;
  
  // Count actual pages in config
  return typedConfig.pages && Array.isArray(typedConfig.pages) 
    ? typedConfig.pages.length 
    : 1;
}

  private async logTemplateCreation(template: PdfTemplate, userId: string): Promise<void> {
    // This would typically log to an audit trail
    console.log(`PDF Template created: ${template.id} by user ${userId}`);
  }
}