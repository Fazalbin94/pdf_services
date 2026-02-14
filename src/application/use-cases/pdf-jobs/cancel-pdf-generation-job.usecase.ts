import { PdfGenerationJobRepository } from "@application/interfaces/pdf-generation-job-repository.js";
import { PdfGenerationJob } from "@domain/entities/pdf-generation-job.entity.js";
import { PdfGenerationJobAccessDeniedError, PdfGenerationJobError, PdfGenerationJobNotFoundError } from "@domain/errors/pdf-generation-job-error.js";

 

export class CancelPdfGenerationJobUseCase {
  constructor(private readonly pdfGenerationJobRepository: PdfGenerationJobRepository) {}

  // Add this to debug in your CancelPdfGenerationJobUseCase
async execute(
  userId: string,
  jobId: string,
  organizationId?: string | null
): Promise<PdfGenerationJob> {
  try {
    console.log('Cancel job attempt:', { userId, jobId, organizationId });
    
    // 1. Get job
    const job = await this.pdfGenerationJobRepository.findById(jobId);
    console.log('Found job:', job);
    
    if (!job) {
      console.log('Job not found');
      throw new PdfGenerationJobNotFoundError(jobId);
    }

    // 2. Check access permissions
    console.log('Validating access...');
    await this.validateJobAccess(job, userId, organizationId);
    console.log('Access validated');

    // 3. Check if job can be cancelled
    console.log('Current job status:', job.status);
    if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(job.status)) {
      console.log('Job cannot be cancelled - status:', job.status);
      throw new PdfGenerationJobError(
        'CANNOT_CANCEL',
        `Job is already ${job.status.toLowerCase()}`
      );
    }

    // 4. Cancel job
    console.log('Attempting to cancel job...');
    const cancelledJob = await this.pdfGenerationJobRepository.cancel(jobId);
    console.log('Job cancelled successfully:', cancelledJob);

    // 5. Log cancellation
    await this.logJobCancellation(cancelledJob, userId);

    return cancelledJob;

  } catch (error) {
    console.error('Cancel job error:', error);
    console.error('Error name:', error?.constructor?.name);
     
    
    if (
      error instanceof PdfGenerationJobNotFoundError ||
      error instanceof PdfGenerationJobAccessDeniedError ||
      error instanceof PdfGenerationJobError
    ) {
      throw error;
    }
    
    throw new PdfGenerationJobError(
      'CANCEL_FAILED',
      'Failed to cancel PDF generation job',
      error as Error
    );
  }
}

 private async validateJobAccess(
  job: PdfGenerationJob,
  userId: string,
  organizationId?: string | null
): Promise<void> {
  if (!job || !job.template) {
    throw new PdfGenerationJobNotFoundError(job?.id || 'unknown');
  }

  const { template } = job;

  // Access rules in order of priority:
   if(userId){
    return 
   }

  // No access
  throw new PdfGenerationJobAccessDeniedError(job.id);
}

  private async logJobCancellation(job: PdfGenerationJob, userId: string): Promise<void> {
    // This would typically log to an audit trail
    console.log(`PDF Generation Job cancelled: ${job.id} by user ${userId}`);
  }
}