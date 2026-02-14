// src/application/use-cases/pdf-templates/clone-pdf-template.usecase.ts
 
import type { ClonePdfTemplateData, CreatePdfTemplateData } from '../../dto/pdf-template.dto.js';
import type { PdfTemplate } from '../../../domain/entities/pdf-template.entity.js';
import { PdfTemplateError, PdfTemplateNotFoundError, PdfTemplateAccessDeniedError } from '../../../domain/errors/pdf-template-error.js';
import { PdfTemplateRepository } from '@application/interfaces/pdf-template-repository.js';

 // src/application/use-cases/pdf-templates/clone-pdf-template.usecase.ts
export class ClonePdfTemplateUseCase {
  constructor(private readonly pdfTemplateRepository: PdfTemplateRepository) {}

  async execute(
    userId: string,
    templateId: string,
    data: ClonePdfTemplateData,
    organizationId?: string | null
  ): Promise<PdfTemplate> {
    try {
      console.log('Clone use case data:', data);
      
      // Validate required data
      if (!data.newName || data.newName.trim().length === 0) {
        throw new PdfTemplateError(
          'CLONE_FAILED',
          'New name is required for cloning'
        );
      }

      // 1. Get the original template
      const originalTemplate = await this.pdfTemplateRepository.findById(templateId);
      if (!originalTemplate) {
        throw new PdfTemplateNotFoundError(templateId);
      }

      // 2. Check if user has access to clone this template
      const canClone = this.checkCloneAccess(
        originalTemplate,
        userId,
        organizationId
      );

      if (!canClone) {
        throw new PdfTemplateAccessDeniedError(templateId);
      }

      // 3. Check if template is active (allow cloning inactive with warning)
      if (!originalTemplate.isActive) {
        console.warn(`Cloning inactive template: ${templateId}`);
        // Optionally, you can throw an error here if you don't want to allow cloning inactive templates
        // throw new PdfTemplateError(
        //   'TEMPLATE_INACTIVE',
        //   'Cannot clone an inactive template'
        // );
      }

      // 4. Check if new name already exists for this user/organization
      const existingTemplate = await this.pdfTemplateRepository.findByName(
        data.newName.trim(),
        userId,
        organizationId || null
      );

      if (existingTemplate) {
        throw new PdfTemplateError(
          'TEMPLATE_NAME_EXISTS',
          `A PDF template with name "${data.newName}" already exists`
        );
      }

      // 5. Prepare cloned template data
      const clonedData = this.prepareClonedData(
        originalTemplate,
        data,
        userId,
        organizationId
      );

      // 6. Create the cloned template
      const clonedTemplate = await this.pdfTemplateRepository.create(clonedData);

      // 7. Create stats for the cloned template
      //await this.createTemplateStats(clonedTemplate.id);

      // 8. Log the cloning action
      await this.logCloningAction(originalTemplate, clonedTemplate, userId);

      return clonedTemplate;

    } catch (error) {
      console.error('Error during cloning PDF template:', error);
      
      // Re-throw known errors
      if (
        error instanceof PdfTemplateNotFoundError ||
        error instanceof PdfTemplateAccessDeniedError ||
        error instanceof PdfTemplateError
      ) {
        throw error;
      }
      
      // Wrap unknown errors
      throw new PdfTemplateError(
        'CLONE_FAILED',
        'Failed to clone PDF template',
        error as Error
      );
    }
  }

  private checkCloneAccess(
    template: PdfTemplate,
    userId: string,
    organizationId?: string | null
  ): boolean {
    // Debug logging
    console.log('Access check:', {
      templateUserId: template.userId,
      currentUserId: userId,
      templateIsPublic: template.isPublic,
      templateOrgId: template.organizationId,
      userOrgId: organizationId,
      templateIsSystem: template.isSystem,
    });

    // 1. User owns the template
    if (template.userId === userId) {
      console.log('Access granted: User owns the template');
      return true;
    }

    // 2. Template is public
    if (template.isPublic) {
      console.log('Access granted: Template is public');
      return true;
    }

    // 3. Organization access
    if (organizationId && template.organizationId === organizationId) {
      console.log('Access granted: User belongs to template organization');
      return true;
    }

    // 4. System templates - check if user can access system templates
    if (template.isSystem) {
      console.log('Checking system template access');
      const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
      if (userId === SYSTEM_USER_ID) {
        console.log('Access granted: User is system admin');
        return true;
      }
      // System templates might have additional rules
      // For now, allow if template is public (already checked above)
    }

    console.log('Access denied: No matching access rule');
    return false;
  }

  private prepareClonedData(
    originalTemplate: PdfTemplate,
    cloneData: ClonePdfTemplateData,
    userId: string,
    organizationId?: string | null
  ): CreatePdfTemplateData {
    // Ensure all fields have proper defaults
    const newName = cloneData.newName.trim();
    const newTitle = cloneData.newTitle?.trim() || `${originalTemplate.title} (Clone)`;
    
    return {
      // Required fields
      userId: userId,
      organizationId: organizationId || originalTemplate.organizationId || null,
      name: newName,
      title: newTitle,
      
      // Optional fields from clone data or original
      description: cloneData.newDescription || originalTemplate.description || null,
      category: cloneData.newCategory || originalTemplate.category || null,
      
      // Arrays - create new copies
      tags: originalTemplate.tags ? [...originalTemplate.tags] : [],
      
      // JSON fields - create deep copies
      config: originalTemplate.config ? JSON.parse(JSON.stringify(originalTemplate.config)) : {},
      variables: originalTemplate.variables ? JSON.parse(JSON.stringify(originalTemplate.variables)) : null,
      defaultData: originalTemplate.defaultData ? JSON.parse(JSON.stringify(originalTemplate.defaultData)) : null,
      validationRules: originalTemplate.validationRules ? JSON.parse(JSON.stringify(originalTemplate.validationRules)) : null,
      margins: originalTemplate.margins ? JSON.parse(JSON.stringify(originalTemplate.margins)) : null,
      fonts: originalTemplate.fonts ? JSON.parse(JSON.stringify(originalTemplate.fonts)) : null,
      styles: originalTemplate.styles ? JSON.parse(JSON.stringify(originalTemplate.styles)) : null,
      headerContent: originalTemplate.headerContent ? JSON.parse(JSON.stringify(originalTemplate.headerContent)) : null,
      footerContent: originalTemplate.footerContent ? JSON.parse(JSON.stringify(originalTemplate.footerContent)) : null,
      
      // Simple fields
      pageSize: originalTemplate.pageSize,
      orientation: originalTemplate.orientation,
      backgroundType: originalTemplate.backgroundType,
      backgroundUrl: originalTemplate.backgroundUrl || null,
      backgroundColor: originalTemplate.backgroundColor || null,
      opacity: originalTemplate.opacity || 1.0,
      letterheadId: originalTemplate.letterheadId || null,
      
      // Version and flags
      version: '1.0.0',
      isActive: cloneData.isActive !== undefined ? cloneData.isActive : true,
      isPublic: cloneData.isPublic !== undefined ? cloneData.isPublic : false,
      isSystem: false, // Clones are never system templates
      
      // Media and metadata
      thumbnailUrl: originalTemplate.thumbnailUrl || null,
      estimatedPages: originalTemplate.estimatedPages || null,
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: null,
      deletedAt: null,
    };
  }

 

  private async logCloningAction(
    originalTemplate: PdfTemplate,
    clonedTemplate: PdfTemplate,
    userId: string
  ): Promise<void> {
    console.log(`Template cloned successfully: 
      Original: ${originalTemplate.id} (${originalTemplate.name})
      Clone: ${clonedTemplate.id} (${clonedTemplate.name})
      User: ${userId}
    `);
    
    // You could also:
    // 1. Create an audit log entry in a separate table
    // 2. Update usage statistics
    // 3. Send notifications
  }
}