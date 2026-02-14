

import { PdfMetadata, TemplateData } from "@application/dto/generate-pdf.dto.js";
import { JobStatus } from "@application/dto/pdf-job.dto.js";
 
import {  JobOptions, JobProgressUpdate, JobQueryFilters, JobStats,   PdfGenerationJob } from "@domain/entities/pdf-generation-job.entity.js";
import { PaginationOptions } from "@shared/types/pagination.js";
 
  
  
 
export interface PdfGenerationJobRepository {

  create(data: CreatePdfGenerationJobData): Promise<PdfGenerationJob>;
  findById(id: string): Promise<PdfGenerationJob | null>;
  findByIdWithRelations(id: string): Promise<PdfGenerationJob | null>;
  update(id: string, data: Partial<PdfGenerationJob>): Promise<PdfGenerationJob>;
  

  cancel(id: string): Promise<PdfGenerationJob>;
  findPending(limit?: number): Promise<PdfGenerationJob[]>;
  

  findAll(filters?: PdfGenerationJobFilters, pagination?: PaginationOptions): Promise<{ items: PdfGenerationJob[]; total: number }>;
   findAll(
    filters?: PdfGenerationJobFilters | JobQueryFilters, // Accept either
    pagination?: PaginationOptions
  ): Promise<{ items: PdfGenerationJob[]; total: number }>;

  
  getStats(filters: JobStatsFilters): Promise<JobStats>;
  updateProgress(jobId: string, progress: JobProgressUpdate): Promise<void>;
  retryJob(id: string, options?: RetryJobOptions): Promise<PdfGenerationJob>;
  markAsProcessing(id: string, workerId: string): Promise<PdfGenerationJob>;
  markAsCompleted(id: string, documentId: string): Promise<PdfGenerationJob>;
  markAsFailed(id: string, error: Error): Promise<PdfGenerationJob>;
  cleanupExpiredJobs(): Promise<{ deleted: number }>;
  getQueueStats(): Promise<QueueStats>;
}


 

export interface CreatePdfGenerationJobData {
 

    templateId: string;
  data: TemplateData;
  options?: JobOptions | null;  
  status?: JobStatus;
  priority?: number;
  attempts?: number;
  maxAttempts?: number;
  callbackUrl?: string | null;  
  scheduledAt?: Date;
  timeoutAt?: Date;
  metadata?: JobMetadata | null;  
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string | null;  
  organizationId?: string | null;  
}


export interface PdfGenerationJobFilters {
  templateId?: string;
  status?: JobStatus;
  priority?: number;
  fromDate?: Date;
  toDate?: Date;
  search?: string;

    isPreview?: 'true' | 'false';
  sortBy?: string;
  sortOrder?: string;
  page?: string;
  limit?: string;

  
}

 
export interface JobStatsFilters {
  userId?: string;
  organizationId?: string | null;
  period?: 'hour' |'day' | 'week' | 'month' | 'year' | 'custom' | 'all';
  fromDate?: Date;
  toDate?: Date;
  templateId?: string;
  status?: JobStatus;
  queueName?: string;
  priority?: number;


}

export interface RetryJobOptions {
  maxAttempts?: number;
  delay?: number;
  resetStatus?: boolean;
  newPriority?: number;
}

export interface QueueStats {
  totalJobs: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  timeout: number;
  byPriority: Array<{
    priority: number;
    count: number;
  }>;
  byStatus: Array<{
    status: JobStatus;
    count: number;
  }>;
  averageProcessingTime: number;
  oldestPendingJob?: Date;
  estimatedCompletionTime?: Date;
}

 
// Add these interfaces to your types file

export interface UpdatePdfGenerationJobData extends Partial<CreatePdfGenerationJobData> {
  status?: JobStatus;
  scheduledAt?: Date;
  attempts?: number;
  documentId?: string | null;
  errorMessage?: string | null;
  errorStack?: string | null;
 
  startedAt?: Date | null;
  completedAt?: Date | null;
  timeoutAt?: Date  ;
  queueName?: string | null;
  workerId?: string | null;
  metadata?: JobMetadata;
  progress?: number;
}

 
export interface JobMetadata extends PdfMetadata {
  generationId?: string;
  sessionId?: string;
  workerInfo?: {
    hostname?: string;
    pid?: number;
    version?: string;
  };
  performance?: {
    memoryUsage?: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    cpuUsage?: {
      user: number;
      system: number;
    };
  };
 
  
  retryLink?: {
    retriedToJobId: string;
    retriedToJobStatus: JobStatus;
    wasRetried: boolean;
    retriedAt: Date;
  };
 
 
 
  timing?: {
    queuedAt?: Date;
    processingStartedAt?: Date;
    processingEndedAt?: Date;
    totalDuration?: number;
 
    retriedAt?: Date;
  };
  retryInfo?: {
    originalJobId?: string;
    retryCount: number;
    lastError?: string;

    
  };
  custom?: Record<string, unknown>;
}

export type StatsPeriod = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';

export interface StatsFilters {
  period?: StatsPeriod;
  templateId?: string;
  fromDate?: Date;
  toDate?: Date;
}
 export interface PeriodStats {
  period: string;
  count: number;
  completed: number;
  failed: number;
  cancelled: number;
  pending?: number;
  processing?: number;

  
}
export interface StatsWhereClause {
   templateId?: string;
  userId?: string;
  organizationId?: string | null;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  status?: JobStatus;
  queueName?: string;
  priority?: number;
  
 
}

export interface JobStatsResult {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  avgProcessingTime: number | null;
  avgPriority: number;
  avgAttempts: number;
  avgMaxAttempts: number;
  successRate: number;
  byTemplate: Array<{
    templateId: string;
    templateName: string;
    templateTitle: string;
    count: number;
  }>;
  byPeriod: PeriodStats[];
  statusCounts: {
    PENDING: number;
    PROCESSING: number;
    COMPLETED: number;
    FAILED: number;
    CANCELLED: number;
  };
}
 
export interface RawAvgProcessingTimeResult {
  avg_processing_time: number;
}

export type StatusCountResult = {
  status: string;
  _count: {
    _all: number;
  };
};

export type PriorityCountResult = {
  priority: number;
  _count: {
    _all: number;
  };
};
