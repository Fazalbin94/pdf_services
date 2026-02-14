import { PdfTemplateRepository } from "@application/interfaces/pdf-template-repository.js";
import { PdfTemplateAccessDeniedError, PdfTemplateError, PdfTemplateNotFoundError } from "@domain/errors/domain-error.js";
import { PdfTemplate } from "@prisma/client";

 
export class RestorePdfTemplateUseCase {
  constructor(private readonly pdfTemplateRepository: PdfTemplateRepository) {}

  async execute(
    userId: string,
    templateId: string,
    organizationId?: string | null
  ): Promise<PdfTemplate> {
    try {
      // 1. Get existing template
      const existingTemplate = await this.pdfTemplateRepository.findById(templateId);
      
      if (!existingTemplate) {
        throw new PdfTemplateNotFoundError(templateId);
      }

      // 2. Check access permissions
      if (existingTemplate.userId !== userId) {
        throw new PdfTemplateAccessDeniedError(templateId);
      }

      // 3. Check organization access
      if (organizationId && existingTemplate.organizationId && existingTemplate.organizationId !== organizationId) {
        throw new PdfTemplateAccessDeniedError(templateId);
      }

      // 4. Check if template is already restored
      if (!existingTemplate.deletedAt) {
        throw new PdfTemplateError(
          'TEMPLATE_NOT_DELETED',
          `Template ${templateId} is not deleted`
        );
      }

  
      const restoredTemplate = await this.pdfTemplateRepository.update(templateId, {
        deletedAt: null,
        isActive: true,
        updatedAt: new Date(),
      });
 
      const sanitized = {
        ...restoredTemplate,
       
        config: JSON.parse(JSON.stringify(restoredTemplate.config)),
      } as unknown as PdfTemplate;
 
      return sanitized;

    } catch (error) {
      if (
        error instanceof PdfTemplateNotFoundError ||
        error instanceof PdfTemplateAccessDeniedError ||
        error instanceof PdfTemplateError
      ) {
        throw error;
      }
      
      throw new PdfTemplateError(
        'RESTORE_FAILED',
        'Failed to restore PDF template',
        error as Error
      );
    }
  }
}