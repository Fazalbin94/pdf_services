 import { PdfMetadata, TemplateData, TemplateVariables } from "@application/dto/generate-pdf.dto.js";
import { PdfTemplateConfig } from "@application/dto/pdf-template.dto.js";
import { JobMetadata, PeriodStats } from "@application/interfaces/pdf-generation-job-repository.js";
import { JobStatus } from "@prisma/client";
import type { 
  PdfGenerationJob as PrismaPdfGenerationJob,
  PdfTemplate as PrismaPdfTemplate,
  PdfDocument as PrismaPdfDocument 
} from '@prisma/client';

export interface PdfGenerationJob {
  id: string;
  templateId: string;
  template?: {
    id: string;
    name: string;
    title: string;
    config?: PdfTemplateConfig | null;
    userId?: string;
    organizationId?: string | null;
    isActive?: boolean;
    isPublic?: boolean;
    version?: string;
  };
    userId: string | null;
  organizationId: string | null;
  
  estimatedCompletionTime?: Date | null;
  data: TemplateData;
  options: JobOptions | null;
  progress?: number;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  documentId: string | null;
  document?: JobDocument | null;
  errorMessage: string | null;
  errorStack: string | null;
  callbackUrl: string | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  timeoutAt: Date | null;
  queueName: string | null;
  workerId: string | null;
  metadata: JobMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryJobResponse extends PdfGenerationJob {
  retryCount: number;
  originalJobId: string;
  originalStatus: JobStatus;
  retryReason?: string;
  parentJobId?: string;
}

// Supporting types

export interface JobOptions {
  quality?: 'low' | 'medium' | 'high';
  includeMetadata?: boolean;
  filename?: string;
  priority?: 0 | 1 | 2 | 3 | 4 | 5;
  callbackUrl?: string;
  maxAttempts?: number;
  timeoutSeconds?: number;
  metadata?: PdfMetadata;
  expiresInHours?: number;
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  webhookHeaders?: Record<string, string>;
  notifyEmail?: string;
  notifyOnComplete?: boolean;
  compression?: {
    enabled: boolean;
    quality?: number; // 0-100
    method?: 'flate' | 'jpeg';
  };
  security?: {
    password?: string;
    permissions?: {
      print?: boolean;
      modify?: boolean;
      copy?: boolean;
      annotate?: boolean;
    };
  };
}

export interface JobDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  pageCount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | null;
  isPreview?: boolean;
  variables?: TemplateVariables | null;
}





// Additional related types

export interface JobProgressUpdate {
  jobId: string;
  progress: number; // 0-100
  status: JobStatus;
  currentStep?: string;
  stepProgress?: number; // 0-100 for current step
  estimatedTimeRemaining?: number; // seconds
  message?: string;
  metadata?: Partial<JobMetadata>;
}

export interface JobQueueInfo {
  name: string;
  jobCount: number;
  activeWorkers: number;
  processing: number;
  waiting: number;
  failed: number;
  completed: number;
  oldestJob?: Date;
  throughput?: number; // jobs per hour
  averageProcessingTime?: number; // seconds
}

export interface JobStats {
     
 
 
  totalJobs: number;
  byStatus: Record<JobStatus, number>;
  byPriority: Record<number, number>;
  byTemplate?: Array<{
    templateId: string;
    templateName: string;
    count: number;
    successRate: number;
  }>;
  byHour?: Array<{
    hour: string;
    count: number;
    successCount: number;
  }>;
  byPeriod?: PeriodStats[];  
  averageProcessingTimes?: {
    overall: number;
    byPriority: Record<number, number>;
    byStatus: Record<JobStatus, number>;
  };
  failureReasons?: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
}

export interface JobCancellationOptions {
  reason?: string;
  force?: boolean;
  cleanupDocument?: boolean;
  sendNotification?: boolean;
}

export interface JobWebhookEvent {
  jobId: string;
  event: 'created' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled' | 'retried';
  status: JobStatus;
  timestamp: Date;
  data?: {
    documentId?: string;
    documentUrl?: string;
    fileName?: string;
    fileSize?: number;
    errorMessage?: string;
    progress?: number;
    metadata?: JobMetadata;
  };
  signature?: string;
}

// For batch job operations
export interface BatchJobInfo {
  batchId: string;
  name?: string;
  description?: string;
  jobIds: string[];
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}



// Helper types for querying
export interface JobQueryFilters {
  status?: JobStatus | JobStatus[];
  priority?: number | { min?: number; max?: number };
  templateId?: string | string[];
  fromDate?: Date;
  toDate?: Date;
  queueName?: string;
  workerId?: string;
  hasError?: boolean;
  isExpired?: boolean;
  search?: string;
  userId?: string;
  organizationId?: string;
}

 
 // Create a proper type for Prisma job with relations
export type PrismaPdfGenerationJobWithRelations = PrismaPdfGenerationJob & {
  template?: PrismaPdfTemplate | null;
  document?: PrismaPdfDocument | null;
} 

export interface PdfGenerationJobMetadata {
  userId?: string | null;
  organizationId?: string | null;
  data?: object;
  options?: object | null;
  callbackUrl?: string | null;
  status?: JobStatus;
  priority?: number;
  attempts?: number;
  maxAttempts?: number;
  errorMessage?: string | null;
  errorStack?: string | null;
  scheduledAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  timeoutAt?: Date | null;
  queueName?: string | null;
  workerId?: string | null;
  documentId?: string | null;
}
