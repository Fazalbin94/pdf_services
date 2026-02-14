
 
 import { PdfTemplateRepository } from '@application/interfaces/pdf-template-repository.js';
import type { PdfTemplate } from '../../../domain/entities/pdf-template.entity.js';
import { 
  PdfTemplateError, 
  PdfTemplateNotFoundError,
  PdfTemplateAccessDeniedError,
  PdfTemplateValidationError,
  PdfTemplateDuplicateError 
} from '../../../domain/errors/pdf-template-error.js';
import { UpdatePdfTemplateData } from '@application/dto/pdf-template.dto.js';

export class UpdatePdfTemplateUseCase {
  constructor(private readonly pdfTemplateRepository: PdfTemplateRepository) {}

  async execute(
    userId: string,
    templateId: string,
    data: UpdatePdfTemplateData,
    organizationId?: string | null
  ): Promise<PdfTemplate> {
    try {

      const existingTemplate = await this.pdfTemplateRepository.findById(templateId);
      
      if (!existingTemplate) {
        throw new PdfTemplateNotFoundError(templateId);
      }


      this.validateAccess(existingTemplate, userId, organizationId);


      if (existingTemplate.deletedAt) {
        throw new PdfTemplateError(
          'TEMPLATE_DELETED',
          `Cannot update deleted template: ${templateId}`
        );
      }


      this.validateUpdateData(data);


      if (data.name && data.name !== existingTemplate.name) {
        await this.checkDuplicateName(
          data.name,
          userId,
          organizationId,
          templateId
        );
      }


      if (data.config) {
        this.validateTemplateConfig(data.config);
      }


      const updateData = this.prepareUpdateData(data, existingTemplate);


      const updatedTemplate = await this.pdfTemplateRepository.update(
        templateId,
        updateData
      );


      await this.logTemplateUpdate(updatedTemplate, userId);

      return updatedTemplate;

    } catch (error) {
      console.log('Update PDF Template Error:', error);
      if (
        error instanceof PdfTemplateError ||
        error instanceof PdfTemplateNotFoundError ||
        error instanceof PdfTemplateAccessDeniedError ||
        error instanceof PdfTemplateValidationError ||
        error instanceof PdfTemplateDuplicateError
      ) {
        throw error;
      }
      
      throw new PdfTemplateError(
        'UPDATE_FAILED',
        'Failed to update PDF template',
        error as Error
      );
    }
  }

  private validateAccess(
    template: PdfTemplate,
    userId: string,
    organizationId?: string | null
  ): void {

    if (template.userId !== userId) {
      throw new PdfTemplateAccessDeniedError(template.id);
    }
    

    if (organizationId && template.organizationId && template.organizationId !== organizationId) {
      throw new PdfTemplateAccessDeniedError(template.id);
    }

     
    if (!organizationId && template.organizationId) {
      throw new PdfTemplateAccessDeniedError(template.id);
    }
  }

  private validateUpdateData(data: UpdatePdfTemplateData): void {
    const errors: string[] = [];


    if (data.name !== undefined) {
      if (!data.name.trim()) {
        errors.push('Template name cannot be empty');
      } else if (data.name.length > 100) {
        errors.push('Template name must be 100 characters or less');
      }
    }


    if (data.title !== undefined) {
      if (!data.title.trim()) {
        errors.push('Template title cannot be empty');
      } else if (data.title.length > 200) {
        errors.push('Template title must be 200 characters or less');
      }
    }


    if (data.category !== undefined && data.category && data.category.length > 50) {
      errors.push('Category must be 50 characters or less');
    }


    if (data.tags !== undefined) {
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
    }


    if (data.version && !/^\d+\.\d+\.\d+$/.test(data.version)) {
      errors.push('Version must follow semantic versioning (e.g., 1.0.0)');
    }


    if (data.backgroundColor && !/^#[0-9A-Fa-f]{6}$/.test(data.backgroundColor)) {
      errors.push('Background color must be a valid hex color (e.g., #FF0000)');
    }


    if (data.opacity !== undefined && (data.opacity! < 0 || data.opacity! > 1)) {
      errors.push('Opacity must be between 0 and 1');
    }

    if (errors.length > 0) {
      throw new PdfTemplateValidationError('INVALID_UPDATE_DATA', errors);
    }
  }

  private async checkDuplicateName(
    name: string,
    userId: string,
    organizationId: string | null | undefined,
    excludeTemplateId: string
  ): Promise<void> {
    const existingTemplate = await this.pdfTemplateRepository.findByName(
      name,
      userId,
      organizationId || null
    );

    if (existingTemplate && 
        existingTemplate.id !== excludeTemplateId && 
        !existingTemplate.deletedAt) {
      throw new PdfTemplateDuplicateError(name, userId, organizationId);
    }
  }

 private validateTemplateConfig(config: unknown): void {
  // Type guard to check if it's an object
  if (!config || typeof config !== 'object' || config === null) {
    throw new PdfTemplateValidationError('INVALID_CONFIG', [
      'Template config must be a valid object'
    ]);
  }

 
  const typedConfig = config as Record<string, unknown>;
  
 
  if (typedConfig.pages !== undefined && !Array.isArray(typedConfig.pages)) {
    throw new PdfTemplateValidationError('INVALID_CONFIG', [
      'Template config pages must be an array'
    ]);
  }
}

 private prepareUpdateData(
  data: UpdatePdfTemplateData,
  existingTemplate: PdfTemplate
): Partial<PdfTemplate> {
  const updateData: Partial<PdfTemplate> = { ...data };
  
  // Always update the timestamp
  updateData.updatedAt = new Date();

  // Auto-increment version if config changed
  if (data.config && !data.version) {
    updateData.version = this.incrementVersion(existingTemplate.version);
  }

  // Handle publish date
  if (data.isPublic !== undefined) {
    if (data.isPublic && !existingTemplate.publishedAt) {
      updateData.publishedAt = new Date();
    } else if (!data.isPublic) {
      updateData.publishedAt = null;
    }
  }

  // Handle restoration
  if (data.deletedAt === null && existingTemplate.deletedAt) {
    updateData.deletedAt = null;
    updateData.isActive = true;
  }

  // Recalculate estimated pages if config changed
  if (data.config) {
    updateData.estimatedPages = this.calculateEstimatedPages(data.config);
  }

  return updateData;
}

 private incrementVersion(version: string): string {
  try {
    const versionRegex = /^(\d+)\.(\d+)\.(\d+)$/;
    const match = version.match(versionRegex);

    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      const patch = parseInt(match[3], 10) + 1;
      return `${major}.${minor}.${patch}`;
    }

    // Fallback for invalid version strings
    return '1.0.1';
  } catch (error) {
    console.error('Failed to increment version:', error);
    return '1.0.1'; // fallback version
  }
}


  private calculateEstimatedPages(config: unknown): number {
  // Type guard
  if (!config || typeof config !== 'object' || config === null) {
    return 1;
  }

  const typedConfig = config as { pages?: unknown[] };
  
  if (!typedConfig.pages || !Array.isArray(typedConfig.pages)) {
    return 1;
  }
  
  return typedConfig.pages.length;
}

  private async logTemplateUpdate(template: PdfTemplate, userId: string): Promise<void> {

    console.log(`PDF Template updated: ${template.id} by user ${userId}`);
  }
}