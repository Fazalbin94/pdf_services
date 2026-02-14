
 
import { PdfTemplateRepository } from '@application/interfaces/pdf-template-repository.js';
import type { PdfTemplate } from '../../../domain/entities/pdf-template.entity.js';
import { 
  PdfTemplateError, 
  PdfTemplateNotFoundError,
  PdfTemplateAccessDeniedError 
} from '../../../domain/errors/pdf-template-error.js';

export class DeletePdfTemplateUseCase {
  constructor(private readonly pdfTemplateRepository: PdfTemplateRepository) {}

  async execute(
    userId: string,
    templateId: string,
    organizationId?: string | null,
    forceDelete: boolean = false
  ): Promise<void> {
    try {

      const template = await this.pdfTemplateRepository.findById(templateId);
      
      if (!template) {
        throw new PdfTemplateNotFoundError(templateId);
      }


      this.validateAccess(template, userId, organizationId);


      if (template.deletedAt && !forceDelete) {
        throw new PdfTemplateError(
          'ALREADY_DELETED',
          `Template ${templateId} is already deleted`
        );
      }


      if (template.isSystem && !forceDelete) {
        throw new PdfTemplateError(
          'SYSTEM_TEMPLATE',
          'Cannot delete system templates'
        );
      }


      if (forceDelete) {

        await this.hardDeleteTemplate(templateId);
      } else {

        await this.softDeleteTemplate(templateId);
      }


      await this.logTemplateDeletion(templateId, userId, forceDelete);

    } catch (error) {
      if (
        error instanceof PdfTemplateNotFoundError ||
        error instanceof PdfTemplateAccessDeniedError ||
        error instanceof PdfTemplateError
      ) {
        throw error;
      }
      
      throw new PdfTemplateError(
        'DELETE_FAILED',
        'Failed to delete PDF template',
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

  private async softDeleteTemplate(templateId: string): Promise<void> {

    await this.pdfTemplateRepository.softDelete(templateId);
    

    await this.pdfTemplateRepository.update(templateId, {
      isActive: false,
      isPublic: false,
    });
  }

  private async hardDeleteTemplate(templateId: string): Promise<void> {

    await this.pdfTemplateRepository.delete(templateId);
    


  }

  private async logTemplateDeletion(
    templateId: string,
    userId: string,
    forceDelete: boolean
  ): Promise<void> {
    const action = forceDelete ? 'HARD_DELETE' : 'SOFT_DELETE';
    

    console.log(`PDF Template ${action}: ${templateId} by user ${userId}`);
    

    if (forceDelete) {
      await this.notifyAdmins(templateId, userId);
    }
  }

  private async notifyAdmins(templateId: string, userId: string): Promise<void> {


    console.log(`[ADMIN ALERT] Template ${templateId} hard deleted by user ${userId}`);
  }
}