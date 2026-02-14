 import { TemplateData, TemplateVariables, PdfMetadata } from "@application/dto/generate-pdf.dto.js";
import { PdfDocument } from "@prisma/client";

export interface CreatePdfJobData {
  templateId: string;
  data: TemplateData;
  

  
  options?: {
    quality?: 'low' | 'medium' | 'high';
    includeMetadata?: boolean;
    filename?: string;
    priority?: 0 | 1 | 2;  
    callbackUrl?: string;
    maxAttempts?: number;
    timeoutSeconds?: number;
    metadata?: PdfMetadata;
    expiresInHours?: number;
    ipAddress?: string;
    userAgent?: string;
    webhookHeaders?: Record<string, string>;
  };
}

export interface PdfJobResponse {
  id: string;
  templateId: string;
  templateName?: string;
  data: TemplateData;
  options: CreatePdfJobData['options'] | null;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  documentId: string | null;
  document?: PdfDocument | null;
  errorMessage: string | null;
  errorStack: string | null;
  callbackUrl: string | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  timeoutAt: Date | null;
  estimatedCompletionTime: Date | null;
  queueName: string | null;
  workerId: string | null;
  metadata: PdfMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListPdfJobsFilters {
  templateId?: string;
  status?: JobStatus;
  priority?: number | { min?: number; max?: number };
  fromDate?: Date;
  toDate?: Date;
  sortBy?: 'createdAt' | 'scheduledAt' | 'priority' | 'status' | 'templateId';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  organizationId?: string;
  queueName?: string;
  includeCompleted?: boolean;
  includeFailed?: boolean;
  workerId?: string;
}
 

export type JobStatus = 
  | 'PENDING' | 'PROCESSING' | 'COMPLETED' 
  | 'FAILED' | 'CANCELLED' | 'TIMEOUT'
  | 'RETRYING' | 'PAUSED' | 'QUEUED';

// Additional types for better type safety

export interface JobProgress {
  jobId: string;
  status: JobStatus;
  progress?: number; // 0-100
  currentStep?: string;
  estimatedTimeRemaining?: number; // seconds
  lastUpdated: Date;
}

export interface JobQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  averageProcessingTime?: number;
  byPriority: Record<number, number>;
  byTemplate: Array<{
    templateId: string;
    templateName: string;
    count: number;
  }>;
}

export interface JobWebhookPayload {
  jobId: string;
  status: JobStatus;
  documentId?: string;
  documentUrl?: string;
  fileName?: string;
  fileSize?: number;
  errorMessage?: string;
  errorStack?: string;
  metadata?: Record<string, unknown>;
  completedAt?: Date;
}

export interface UpdateJobData {
  status?: JobStatus;
  attempts?: number;
  documentId?: string | null;
  errorMessage?: string | null;
  errorStack?: string | null;
  scheduledAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  timeoutAt?: Date | null;
  queueName?: string | null;
  workerId?: string | null;
  metadata?: Record<string, unknown>;
}

// Validation types
export interface JobValidationResult {
  isValid: boolean;
  errors?: Array<{
    field: string;
    code: string;
    message: string;
    details?: unknown;
  }>;
  warnings?: Array<{
    field: string;
    code: string;
    message: string;
  }>;
}

// For batch operations
export interface BatchJobData {
  jobs: Array<{
    templateId: string;
    data: TemplateData;
    options?: CreatePdfJobData['options'];
  }>;
  batchOptions?: {
    name?: string;
    description?: string;
    priority?: number;
    notifyOnComplete?: boolean;
    notifyEmail?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface BatchJobResponse {
  batchId: string;
  jobIds: string[];
  totalJobs: number;
  status: 'created' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  successCount?: number;
  failureCount?: number;
}

// Paginated job results
export interface PaginatedJobResult {
  items: PdfJobResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  stats?: {
    byStatus: Record<JobStatus, number>;
    byPriority: Record<number, number>;
    byTemplate?: Array<{
      templateId: string;
      count: number;
    }>;
  };
}

 
export interface JobRetryOptions {
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  retryBackoff?: boolean; // exponential backoff
  retryCondition?: (error: Error, attempt: number) => boolean;
}

 
export interface QueueConfig {
  name: string;
  concurrency: number;
  priority: number;
  timeout: number; // milliseconds
  retry: JobRetryOptions;
  visibilityTimeout?: number; // milliseconds
}