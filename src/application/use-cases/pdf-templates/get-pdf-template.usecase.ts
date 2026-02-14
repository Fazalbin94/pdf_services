
 
 
import { PdfTemplateRepository } from '@application/interfaces/pdf-template-repository.js';
import type { PdfTemplate } from '../../../domain/entities/pdf-template.entity.js';
import { 
  PdfTemplateError, 
  PdfTemplateNotFoundError,
  PdfTemplateAccessDeniedError 
} from '../../../domain/errors/pdf-template-error.js';
import { Fonts, HeaderFooterContent, Margins, PdfTemplateConfig, PublicPdfTemplate, Styles, ValidationRules, Variables } from '@application/dto/pdf-template.dto.js';
 
export class GetPdfTemplateUseCase {
  constructor(
    private readonly pdfTemplateRepository: PdfTemplateRepository,
   )  {}

  async execute(
    userId: string,
    templateId: string,
    organizationId?: string | null
  ): Promise<PdfTemplate> {
    try {

      const template = await this.pdfTemplateRepository.findById(templateId);
      
      if (!template) {
        throw new PdfTemplateNotFoundError(templateId);
      }


      this.validateAccess(template, userId, organizationId);


      if (template.deletedAt) {
        throw new PdfTemplateNotFoundError(templateId);
      }


      this.incrementViewCount(templateId).catch(console.error);


      return template;

    } catch (error) {
      if (
        error instanceof PdfTemplateNotFoundError ||
        error instanceof PdfTemplateAccessDeniedError
      ) {
        throw error;
      }
      
      throw new PdfTemplateError(
        'GET_FAILED',
        'Failed to get PDF template',
        error as Error
      );
    }
  }

   async executePublic(templateId: string): Promise<PublicPdfTemplate> {
  try {
    const template = await this.pdfTemplateRepository.findById(templateId);

    if (!template) {
      throw new PdfTemplateNotFoundError(templateId);
    }

    if (!template.isPublic || !template.isActive) {
      throw new PdfTemplateAccessDeniedError(templateId);
    }

    if (template.deletedAt) {
      throw new PdfTemplateNotFoundError(templateId);
    }

    // Fire-and-forget analytics
    this.incrementViewCount(templateId).catch(console.error);

    return this.sanitizePublicTemplate(template);

  } catch (error) {
    if (
      error instanceof PdfTemplateNotFoundError ||
      error instanceof PdfTemplateAccessDeniedError
    ) {
      throw error;
    }

    throw new PdfTemplateError(
      'GET_PUBLIC_FAILED',
      'Failed to get public PDF template',
      error as Error
    );
  }
}


  private validateAccess(
    template: PdfTemplate,
    userId: string,
    organizationId?: string | null
  ): void {

    if (template.isPublic && template.isActive) {
      return;  
    }


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

  private async incrementViewCount(_templateId: string): Promise<void> {
    try {
     
    } catch (error) {
 // await this.pdfTemplateStatsRepository.incrementViewCount(templateId);
      
      // // Also update last viewed timestamp
      // await this.pdfTemplateStatsRepository.update(templateId, {
      //   lastViewedAt: new Date(),
      // });
      console.error('Failed to increment view count:', error);
    }
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