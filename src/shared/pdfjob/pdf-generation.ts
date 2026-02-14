 import { JobOptions,  PdfGenerationJob } from '@domain/entities/pdf-generation-job.entity.js';
import { JobStatus } from '@prisma/client';
import type { 
  PdfGenerationJob as PrismaPdfGenerationJob,
  PdfTemplate as PrismaPdfTemplate,
  PdfDocument as PrismaPdfDocument 
} from '@prisma/client';

export function calculateProgress(job: PdfGenerationJob): number | null {

  if (job.progress !== undefined) {
    return job.progress;
  }
  

  switch (job.status) {
    case 'PENDING':
      return 0;
    case 'PROCESSING':

      if (job.startedAt && job.estimatedCompletionTime) {
        const startTime = job.startedAt.getTime();
        const estimatedEndTime = job.estimatedCompletionTime.getTime();
        const now = Date.now();
        
        if (now >= estimatedEndTime) return 99;
        
        const totalDuration = estimatedEndTime - startTime;
        const elapsed = now - startTime;
        
        return Math.min(99, Math.max(1, Math.round((elapsed / totalDuration) * 100)));
      }
      return 25; 
    case 'COMPLETED':
      return 100;
    case 'FAILED':
    case 'CANCELLED':
    case 'TIMEOUT':
      return 0;
    default:
      return null;
  }
}
 // Type guards
 export function isJobStatus(value: unknown): value is JobStatus {
   return typeof value === 'string' && [
     'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 
     'CANCELLED', 'TIMEOUT', 'RETRYING', 'PAUSED', 'QUEUED'
   ].includes(value as JobStatus);
 }
 
 export function isJobOptions(value: unknown): value is JobOptions {
   return (
     typeof value === 'object' &&
     value !== null &&
     (value as JobOptions).quality !== undefined
   );
 }

export function logJobCreation(job: PdfGenerationJob, userId: string) : void {
   
    console.log(`PDF Generation Job created: ${job.id} by user ${userId}`);
  }

  export function calculateJobProgress(job: PrismaPdfGenerationJob): number | undefined {
  switch (job.status) {
    case 'PENDING':
      return 0;
    case 'PROCESSING':
      // Calculate based on time if we have start and estimated times
      if (job.startedAt && job.timeoutAt) {
        const startTime = job.startedAt.getTime();
        const timeoutTime = job.timeoutAt.getTime();
        const now = Date.now();
        
        if (now >= timeoutTime) return 99;
        if (now <= startTime) return 1;
        
        const totalDuration = timeoutTime - startTime;
        const elapsed = now - startTime;
        return Math.min(99, Math.max(1, Math.round((elapsed / totalDuration) * 100)));
      }
      return 25; // Default for processing
    case 'COMPLETED':
      return 100;
    case 'FAILED':
    case 'CANCELLED':
    case 'TIMEOUT':
      return 0;
    default:
      return undefined;
  }
}