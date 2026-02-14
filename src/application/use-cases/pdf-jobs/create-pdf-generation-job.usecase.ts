 
import type { CreatePdfGenerationJobData, JobMetadata, PdfGenerationJobRepository } from '../../interfaces/pdf-generation-job-repository.js';
import type { PdfTemplateRepository } from '../../interfaces/pdf-template-repository.js';
import type { CreatePdfJobData, JobStatus } from '../../dto/pdf-job.dto.js';
import type {  PdfGenerationJob, RetryJobResponse } from '../../../domain/entities/pdf-generation-job.entity.js';
import { DomainError, PdfTemplateNotFoundError } from '@domain/errors/domain-error.js';
 
 import { TemplateData, PdfMetadata } from "@application/dto/generate-pdf.dto.js";
import { FieldValidator, ValidationRules } from "@application/dto/pdf-template.dto.js";
import { PdfGenerationJobError } from '@domain/errors/index.js';
import { logJobCreation } from '@shared/pdfjob/pdf-generation.js';
import { isValidUrl } from '@shared/utils/common.js';
import { PdfGenerationJobValidationError } from '@domain/errors/pdf-generation-job-error.js';
import { validateData, validateWithFieldValidator } from '@shared/utils/validateData.js';
import { PdfTemplate } from '@prisma/client';

export class CreatePdfGenerationJobUseCase {
  constructor(
    private readonly pdfGenerationJobRepository: PdfGenerationJobRepository,
    private readonly pdfTemplateRepository: PdfTemplateRepository
  ) {}

  async execute(
    userId: string,
    templateId: string,
    data: TemplateData,
    organizationId?: string | null,
    options?: CreatePdfJobData['options']
  ): Promise<PdfGenerationJob> {
    try {
        const template = await this.pdfTemplateRepository.findById(templateId);
if (!template) {
  throw new PdfTemplateNotFoundError(templateId);
}
    
     if (!template.isActive) {
  throw new PdfGenerationJobError(
    'TEMPLATE_INACTIVE',
    `Template ${templateId} is not active`
  );
}

 
 const templateForAccess = {
  ...template,
  config: template.config ? JSON.parse(JSON.stringify(template.config)) : null,
  variables: template.variables ? JSON.parse(JSON.stringify(template.variables)) : null,
  defaultData: template.defaultData ? JSON.parse(JSON.stringify(template.defaultData)) : null,
  validationRules: template.validationRules ? JSON.parse(JSON.stringify(template.validationRules)) : null,
  margins: template.margins ? JSON.parse(JSON.stringify(template.margins)) : null,
  fonts: template.fonts ? JSON.parse(JSON.stringify(template.fonts)) : null,
  styles: template.styles ? JSON.parse(JSON.stringify(template.styles)) : null,
  headerContent: template.headerContent ? JSON.parse(JSON.stringify(template.headerContent)) : null,
  footerContent: template.footerContent ? JSON.parse(JSON.stringify(template.footerContent)) : null,
};

const hasAccess = await this.checkTemplateAccess(templateForAccess, userId, organizationId);

 
if (!hasAccess) {
  throw new PdfGenerationJobError(
    'ACCESS_DENIED',
    'You do not have access to this template'
  );
}

    // 3. Validate template data
    validateData(templateForAccess, data); // Use the imported validateData

    // 4. Validate job options (separate method)
    if (options) {
      this.validateJobOptions(options);
    }
    

      // 5. Prepare job data with proper typing
      const jobData: CreatePdfGenerationJobData = {
        templateId,
        data,
        options: options ?? undefined,
        status: 'PENDING' as JobStatus,
        priority: options?.priority ?? 0,
        attempts: 0,
        maxAttempts: options?.maxAttempts ?? 3,
        callbackUrl: options?.callbackUrl ?? null,
        scheduledAt: new Date(),
        timeoutAt: options?.timeoutSeconds
          ? new Date(Date.now() + (options.timeoutSeconds * 1000))
          : new Date(Date.now() + (120 * 1000)),
        metadata: options?.metadata ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId,
        organizationId: organizationId ?? null,
      };

      // 6. Create job
      const job = await this.pdfGenerationJobRepository.create(jobData);

      // 7. Log job creation
       logJobCreation(job, userId);

      return job;

    } catch (error: unknown) {
      // Re-throw domain errors
      if (error instanceof DomainError) {
        throw error;
      }
      
      // Wrap unexpected errors
      const errorObj = error instanceof Error ? error : new Error(String(error));
      throw new PdfGenerationJobError(
        'CREATE_FAILED',
        'Failed to create PDF generation job',
        errorObj
      );
    }
  }

 async executeRetry(
  userId: string,
  failedJobId: string,
  organizationId?: string | null
): Promise<PdfGenerationJob> {
  try {
    // 1. Get failed job
    const failedJob = await this.pdfGenerationJobRepository.findById(failedJobId);
    
    if (!failedJob) {
      throw new PdfGenerationJobError(
        'JOB_NOT_FOUND',
        `PDF generation job not found: ${failedJobId}`
      );
    }

    // 2. Check access
    this.validateJobAccess(failedJob, userId, organizationId);

    // 3. Check if job can be retried
    if (!['FAILED', 'CANCELLED'].includes(failedJob.status)) {
      throw new PdfGenerationJobError(
        'CANNOT_RETRY',
        `Only failed or cancelled jobs can be retried. Current status: ${failedJob.status}`
      );
    }

    if (failedJob.attempts >= failedJob.maxAttempts) {
      throw new PdfGenerationJobError(
        'MAX_ATTEMPTS_REACHED',
        `Maximum retry attempts (${failedJob.maxAttempts}) reached`
      );
    }

    // 4. Extract existing options and prepare retry info
    const existingOptions = failedJob.options ?? {};
    const currentRetryCount = (failedJob.metadata?.retryInfo?.retryCount as number) ?? 0;
    const newRetryCount = currentRetryCount + 1;

    // Prepare retry metadata
    const retryMetadata: JobMetadata = {
      ...(failedJob.metadata ?? {}),
      retryInfo: {
        originalJobId: failedJobId,
        retryCount: newRetryCount,
        lastError: failedJob.errorMessage ?? undefined,
      },
      timing: {
        ...(failedJob.metadata?.timing ?? {}),
        retriedAt: new Date(),
      },
    };

    // 5. Create new job data
    const retryJobData: CreatePdfGenerationJobData = {
      templateId: failedJob.templateId,
      data: failedJob.data,
      options: existingOptions, // Options remain the same
      status: 'PENDING',
      priority: failedJob.priority,
      attempts: 0,
      maxAttempts: failedJob.maxAttempts,
      callbackUrl: failedJob.callbackUrl ?? undefined, // Convert null to undefined
      scheduledAt: new Date(),
      timeoutAt: new Date(Date.now() + (120 * 1000)),
      metadata: retryMetadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: userId,
      organizationId: organizationId ?? undefined, // Convert null to undefined
    };

    const retryJob = await this.pdfGenerationJobRepository.create(retryJobData);

    // 6. Update original job metadata
    const updateData: Partial<PdfGenerationJob> = {
      metadata: {
        ...(failedJob.metadata ?? {}),
        retryLink: {
          retriedToJobId: retryJob.id,
          retriedToJobStatus: 'PENDING',
          wasRetried: true,
          retriedAt: new Date(),
        },
      },
      updatedAt: new Date(),
    };

    await this.pdfGenerationJobRepository.update(failedJobId, updateData);

    return retryJob;

  } catch (error: unknown) {
    if (error instanceof PdfGenerationJobError) {
      throw error;
    }
    
    const errorObj = error instanceof Error ? error : new Error(String(error));
    throw new PdfGenerationJobError(
      'RETRY_FAILED',
      'Failed to retry PDF generation job',
      errorObj
    );
  }
}

  private validateJobAccess(
    job: PdfGenerationJob,
    userId: string,
    organizationId?: string | null
  ): void {
    // Check if user owns the job (via template access)
    if (job.userId && job.userId !== userId) {
      throw new PdfGenerationJobError(
        'ACCESS_DENIED',
        'You do not have access to this job'
      );
    }
    
    // Check organization access
    if (organizationId && job.organizationId && job.organizationId !== organizationId) {
      throw new PdfGenerationJobError(
        'ACCESS_DENIED',
        'You do not have access to this job'
      );
    }
  }
  private async checkTemplateAccess(
    template: PdfTemplate,
    userId: string,
    organizationId?: string | null
  ): Promise<boolean> {
    // Template is public
    if (template.isPublic) {
      return true;
    }
    
    // User owns the template
    if (template.userId === userId) {
      return true;
    }
    
    // Organization access
    if (organizationId && template.organizationId && template.organizationId === organizationId) {
      return true;
    }
    
    // // System template access
    // const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
    // if (template.isSystem && template.userId === SYSTEM_USER_ID) {
    //   return true;
    // }
    
    return false;
  }
  
private validateJobOptions(options: CreatePdfJobData['options']): void {
  const errors: string[] = [];

  if (options!.priority !== undefined && ![0, 1, 2, 3, 4, 5].includes(options!.priority)) {
    errors.push('Priority must be between 0 and 5');
  }

  if (options!.maxAttempts !== undefined && (options!.maxAttempts < 1 || options!.maxAttempts > 10)) {
    errors.push('Maximum attempts must be between 1 and 10');
  }

  if (options!.timeoutSeconds !== undefined && (options!.timeoutSeconds < 30 || options!.timeoutSeconds > 600)) {
    errors.push('Timeout must be between 30 and 600 seconds');
  }

  if (options!.callbackUrl && ! isValidUrl(options!.callbackUrl)) {
    errors.push('Callback URL must be a valid URL');
  }

  if (errors.length > 0) {
    throw new PdfGenerationJobValidationError("Job options validation failed", errors);
  }
}

 
  

 
 
}

 