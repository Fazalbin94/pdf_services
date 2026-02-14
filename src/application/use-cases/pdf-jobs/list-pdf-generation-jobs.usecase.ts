import { JobStatus, ListPdfJobsFilters } from "@application/dto/pdf-job.dto.js";
 
import { JobStatsFilters, PdfGenerationJobRepository, PdfGenerationJobFilters } from "@application/interfaces/pdf-generation-job-repository.js";
import { JobQueryFilters, JobStats, PdfGenerationJob } from "@domain/entities/pdf-generation-job.entity.js";
import { PdfGenerationJobError } from "@domain/errors/pdf-generation-job-error.js";
import { PaginatedResult } from "@shared/types/pagination.js";

 

 export class ListPdfGenerationJobsUseCase {
  constructor(private readonly pdfGenerationJobRepository: PdfGenerationJobRepository) {}

  async execute(
    userId: string,
    filters: ListPdfJobsFilters = {},
    organizationId?: string | null
  ): Promise<PaginatedResult<PdfGenerationJob, JobStats>> {
    try {
      // 1. Validate and normalize filters
      const normalizedFilters = this.normalizeFilters(filters);

      // 2. Build query filters for the repository
      const repositoryFilters = this.buildRepositoryFilters(normalizedFilters, userId, organizationId);

      // 3. Execute query with pagination
      const result = await this.pdfGenerationJobRepository.findAll(
        repositoryFilters,
        {
          page: normalizedFilters.page,
          limit: normalizedFilters.limit,
          sortBy: normalizedFilters.sortBy as keyof PdfGenerationJob,
          sortOrder: normalizedFilters.sortOrder,
        }
      );

      // 4. Get job statistics for the response
      const statsFilters: JobStatsFilters = {
        userId,
        organizationId: organizationId ?? undefined,
        fromDate: normalizedFilters.fromDate,
        toDate: normalizedFilters.toDate,
        templateId: normalizedFilters.templateId,
        status: normalizedFilters.status,
      };
      
      const stats = await this.pdfGenerationJobRepository.getStats(statsFilters);

      return {
        items: result.items,
        pagination: {
          page: normalizedFilters.page,
          limit: normalizedFilters.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / normalizedFilters.limit),
          hasNext: normalizedFilters.page < Math.ceil(result.total / normalizedFilters.limit),
          hasPrevious: normalizedFilters.page > 1,
        },
        stats,
      };

    } catch (error: unknown) {
      if (error instanceof PdfGenerationJobError) {
        throw error;
      }
      
      const errorObj = error instanceof Error ? error : new Error(String(error));
      throw new PdfGenerationJobError(
        'LIST_FAILED',
        'Failed to list PDF generation jobs',
        errorObj
      );
    }
  }

  private normalizeFilters(filters: ListPdfJobsFilters): {
    templateId?: string;
    status?: JobStatus;
    priority?: number;
    fromDate?: Date;
    toDate?: Date;
    search?: string;
    page: number;
    limit: number;
    sortBy: keyof PdfGenerationJob;
    sortOrder: 'asc' | 'desc';
  } {
    // Validate job status
    const validStatuses: JobStatus[] = [
      'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 
      'CANCELLED', 'TIMEOUT', 'RETRYING', 'PAUSED', 'QUEUED'
    ];
    
    const status = filters.status && validStatuses.includes(filters.status as JobStatus)
      ? filters.status as JobStatus
      : undefined;

    // Handle priority - convert object to number if needed
    let priority: number | undefined;
    if (filters.priority !== undefined) {
      if (typeof filters.priority === 'number') {
        priority = filters.priority;
      } else if (typeof filters.priority === 'object' && filters.priority !== null) {
        // If it's a range object, use the min value or average
        const priorityObj = filters.priority as { min?: number; max?: number };
        if (priorityObj.min !== undefined) {
          priority = priorityObj.min;
        } else if (priorityObj.max !== undefined) {
          priority = priorityObj.max;
        }
      }
    }

    // Validate sort field
    const validSortFields: Array<keyof PdfGenerationJob> = [
      'createdAt', 'updatedAt', 'scheduledAt', 'priority', 
      'status', 'templateId'
    ];
    
    const sortBy = validSortFields.includes(filters.sortBy as keyof PdfGenerationJob)
      ? filters.sortBy as keyof PdfGenerationJob
      : 'createdAt';

    return {
      templateId: filters.templateId,
      status,
      priority,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      search: filters.search,
      page: Math.max(1, filters.page || 1),
      limit: Math.min(Math.max(1, filters.limit || 20), 100),
      sortBy,
      sortOrder: filters.sortOrder === 'asc' ? 'asc' : 'desc',
    };
  }

  private buildRepositoryFilters(
    filters: ReturnType<typeof this.normalizeFilters>,
    userId: string,
    organizationId?: string | null
  ): PdfGenerationJobFilters {
    const repositoryFilters: PdfGenerationJobFilters = {};

    // User/organization scope
    // if (userId) {
    //   repositoryFilters.userId = userId;
    // }
    
    // if (organizationId) {
    //   repositoryFilters.organizationId = organizationId;
    // }

    // Apply filters
    if (filters.templateId) {
      repositoryFilters.templateId = filters.templateId;
    }

    if (filters.status) {
      repositoryFilters.status = filters.status;
    }

    if (filters.priority !== undefined) {
      repositoryFilters.priority = filters.priority;
    }

    if (filters.fromDate) {
      repositoryFilters.fromDate = filters.fromDate;
    }

    if (filters.toDate) {
      repositoryFilters.toDate = filters.toDate;
    }

    if (filters.search) {
      repositoryFilters.search = filters.search;
    }

    return repositoryFilters;
  }

  // Alternative: If you need to support JobQueryFilters for repository
  private buildJobQueryFilters(
    filters: ReturnType<typeof this.normalizeFilters>,
    userId: string,
    organizationId?: string | null
  ): JobQueryFilters {
    const queryFilters: JobQueryFilters = {};

    // User/organization scope
    if (userId) {
      queryFilters.userId = userId;
    }
    
    if (organizationId) {
      queryFilters.organizationId = organizationId;
    }

    // Apply filters
    if (filters.templateId) {
      queryFilters.templateId = filters.templateId;
    }

    if (filters.status) {
      // JobQueryFilters can accept JobStatus or JobStatus[]; cast to the repository's expected type
      queryFilters.status = filters.status as unknown as JobQueryFilters['status'];
    }

    if (filters.priority !== undefined) {
      // JobQueryFilters can accept number or range
      queryFilters.priority = filters.priority;
    }

    if (filters.fromDate) {
      queryFilters.fromDate = filters.fromDate;
    }

    if (filters.toDate) {
      queryFilters.toDate = filters.toDate;
    }

    if (filters.search) {
      queryFilters.search = filters.search;
    }

    return queryFilters;
  }

  

  async executeStats(
    userId: string,
    filters?: { period?: JobStatsFilters['period']; templateId?: string; fromDate?: Date; toDate?: Date },
    organizationId?: string | null
  ): Promise<JobStats> {
    try {
      const statsFilters: JobStatsFilters = {
        userId,
        organizationId: organizationId ?? undefined,
        period: filters?.period ?? 'month',
        templateId: filters?.templateId,
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
      };
      
      return await this.pdfGenerationJobRepository.getStats(statsFilters);
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      throw new PdfGenerationJobError(
        'GET_STATS_FAILED',
        'Failed to get job statistics',
        errorObj
      );
    }
  }
}
 