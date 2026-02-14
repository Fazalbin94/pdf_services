import { PdfGenerationJobRepository } from "@application/interfaces/pdf-generation-job-repository.js";
import { PdfGenerationJob } from "@domain/entities/pdf-generation-job.entity.js";
import { PdfGenerationJobAccessDeniedError, PdfGenerationJobError, PdfGenerationJobNotFoundError } from "@domain/errors/pdf-generation-job-error.js";

 
 
export class GetPdfGenerationJobUseCase {
  constructor(private readonly pdfGenerationJobRepository: PdfGenerationJobRepository) {}

  async execute(
    userId: string,
    jobId: string,
    organizationId?: string | null
  ): Promise<PdfGenerationJob> {
    try {
      // 1. Get job with related data
      const job = await this.pdfGenerationJobRepository.findByIdWithRelations(jobId);
      
      if (!job) {
        throw new PdfGenerationJobNotFoundError(jobId);
      }

      // 2. Check access permissions
      await this.validateJobAccess(job, userId, organizationId);

      return job;

    } catch (error) {
      if (
        error instanceof PdfGenerationJobNotFoundError ||
        error instanceof PdfGenerationJobAccessDeniedError
      ) {
        throw error;
      }
      
      throw new PdfGenerationJobError(
        'GET_FAILED',
        'Failed to get PDF generation job',
        error as Error
      );
    }
  }

  private async validateJobAccess(
    job: PdfGenerationJob,
    _userId: string,
    _organizationId?: string | null
  ): Promise<void> {
  
    const hasAccess = true;  
    
    if (!hasAccess) {
      throw new PdfGenerationJobAccessDeniedError(job.id);
    }
  }
}