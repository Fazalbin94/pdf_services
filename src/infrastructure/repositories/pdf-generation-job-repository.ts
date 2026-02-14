 import { ILogger } from "@infrastructure/logger/logger.js";
import { CreatePdfGenerationJobData,   JobMetadata,   JobStatsFilters,   PdfGenerationJobFilters, PdfGenerationJobRepository, PeriodStats, PriorityCountResult, QueueStats, RawAvgProcessingTimeResult, RetryJobOptions, StatsFilters, StatsPeriod, StatsWhereClause, StatusCountResult } from "@application/interfaces/pdf-generation-job-repository.js";
import { JobOptions, JobProgressUpdate, JobStats, PdfGenerationJob, PdfGenerationJobMetadata, PrismaPdfGenerationJobWithRelations } from "@domain/entities/pdf-generation-job.entity.js";
import { PdfGenerationJobError } from "@domain/errors/index.js";
import { Prisma } from "@prisma/client";
import {   PrismaClient } from "@prisma/client/extension";
import type { 
 
  PdfTemplate as PrismaPdfTemplate,
  PdfDocument as PrismaPdfDocument, 
  JobStatus
} from '@prisma/client';

 
 import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PaginationOptions } from "@shared/types/pagination.js";
import { PdfTemplateConfig } from "@application/dto/pdf-template.dto.js";
  import { PdfGenerationJob as PrismaPdfGenerationJob } from '@prisma/client';
import { TemplateData, TemplateVariables } from "@application/dto/generate-pdf.dto.js";
import { escapeSqlValue, extractFilterValues, parseJsonField } from "@shared/utils/common.js";
import { calculateJobProgress } from "@shared/pdfjob/pdf-generation.js";

export class PrismaPdfGenerationJobRepository implements PdfGenerationJobRepository {
  constructor(private readonly prisma: PrismaClient,
 private readonly logger: ILogger,

  ) {}
  

  async create(data: CreatePdfGenerationJobData): Promise<PdfGenerationJob> {
    try {
      const job = await this.prisma.pdfGenerationJob.create({
        data: {
          templateId: data.templateId,
          data: data.data,
          options: data.options,
          status: data.status || 'PENDING',
          priority: data.priority || 0,
          attempts: data.attempts || 0,
          maxAttempts: data.maxAttempts || 3,
          callbackUrl: data.callbackUrl,
          scheduledAt: data.scheduledAt || new Date(),
          timeoutAt: data.timeoutAt,
         
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      });

      return this.mapToDomain(job);
    } 
  catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2003') {
      throw new PdfGenerationJobError(
        'TEMPLATE_NOT_FOUND',
        `Template with ID ${data.templateId} not found`
      );
    }
  }

  if (error instanceof Error) {
    throw new PdfGenerationJobError(
      'CREATE_FAILED',
      'Failed to create PDF generation job',
      error
    );
  }

  throw new PdfGenerationJobError(
    'CREATE_FAILED',
    'Failed to create PDF generation job'
  );
}

  }

  async findById(id: string): Promise<PdfGenerationJob | null> {
    try {
      const job = await this.prisma.pdfGenerationJob.findUnique({
        where: { id },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
               
            userId: true,
            organizationId: true,
            isActive: true,
            isPublic: true,
            version: true,
            config: true,  
            },
          },
        },
      });
      if (!job) return null;
      return this.mapToDomain(job);
    } catch (error) {
      throw new PdfGenerationJobError(
        'FIND_BY_ID_FAILED',
        `Failed to find PDF generation job with ID: ${id}`,
        error as Error
      );
    }
  }

  async findByIdWithRelations(id: string): Promise<PdfGenerationJob | null> {
    try {
      const job = await this.prisma.pdfGenerationJob.findUnique({
        where: { id },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
          document: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              fileUrl: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });
      if (!job) return null;
      return this.mapToDomain(job);
    } catch (error) {
      throw new PdfGenerationJobError(
        'FIND_BY_ID_FAILED',
        `Failed to find PDF generation job with ID: ${id}`,
        error as Error
      );
    }
  }

  async update(id: string,   data: Partial<PdfGenerationJob> & { metadata?: PdfGenerationJobMetadata }): Promise<PdfGenerationJob> {
  try {
  const { metadata, ...rest } = data;

  const updateData = metadata
    ? {
        userId: metadata.userId ?? null,
        organizationId: metadata.organizationId ?? null,
        data: metadata.data ?? undefined,
        options: metadata.options ?? undefined,
        callbackUrl: metadata.callbackUrl ?? null,
        status: metadata.status ?? undefined,
        priority: metadata.priority ?? undefined,
        attempts: metadata.attempts ?? undefined,
        maxAttempts: metadata.maxAttempts ?? undefined,
        errorMessage: metadata.errorMessage ?? null,
        errorStack: metadata.errorStack ?? null,
        scheduledAt: metadata.scheduledAt ?? null,
        startedAt: metadata.startedAt ?? null,
        completedAt: metadata.completedAt ?? null,
        timeoutAt: metadata.timeoutAt ?? null,
        queueName: metadata.queueName ?? null,
        workerId: metadata.workerId ?? null,
        documentId: metadata.documentId ?? null,
        ...rest,  
        }
      : { ...rest };

    const job = await this.prisma.pdfGenerationJob.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            title: true,
          },
        },
      },
    });

    return this.mapToDomain(job);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new PdfGenerationJobError(
          'NOT_FOUND',
          `PDF generation job with ID ${id} not found`
        );
      }
    }

    if (error instanceof Error) {
      throw new PdfGenerationJobError(
        'UPDATE_FAILED',
        `Failed to update PDF generation job with ID: ${id}`,
        error
      );
    }

    throw new PdfGenerationJobError(
      'UPDATE_FAILED',
      `Failed to update PDF generation job with ID: ${id}`
    );
  }
}


  async cancel(id: string): Promise<PdfGenerationJob> {
    try {
      const job = await this.prisma.pdfGenerationJob.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      });
      return this.mapToDomain(job);
    } catch (error) {
      throw new PdfGenerationJobError(
        'CANCEL_FAILED',
        `Failed to cancel PDF generation job with ID: ${id}`,
        error as Error
      );
    }
  }

  async findAll(
    filters?: PdfGenerationJobFilters,
    pagination?: PaginationOptions
  ): Promise<{ items: PdfGenerationJob[]; total: number }> {
    try {
      const where = this.buildWhereClause(filters);
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const skip = (page - 1) * limit;
      const orderBy = this.buildOrderBy(pagination);

      const [jobs, total] = await Promise.all([
        this.prisma.pdfGenerationJob.findMany({
          where,
          include: {
            template: {
              select: {
                id: true,
                name: true,
                title: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy,
        }),
        this.prisma.pdfGenerationJob.count({ where }),
      ]);

      return {
        items: jobs.map(this.mapToDomain),
        total,
      };
    } catch (error) {
      throw new PdfGenerationJobError(
        'FIND_ALL_FAILED',
        'Failed to find PDF generation jobs',
        error as Error
      );
    }
  }

  async findPending(limit?: number): Promise<PdfGenerationJob[]> {
    try {
      const jobs = await this.prisma.pdfGenerationJob.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: new Date() },
          timeoutAt: { gt: new Date() },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        take: limit || 10,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              title: true,
              config: true,
            },
          },
        },
      });
      return jobs.map(this.mapToDomain);
    } catch (error) {
      throw new PdfGenerationJobError(
        'FIND_PENDING_FAILED',
        'Failed to find pending PDF generation jobs',
        error as Error
      );
    }
  }

 
 
 
// Then fix the getStats method:
async getStats(filters: JobStatsFilters): Promise<JobStats> {
  try {
    // Build where clause using filters
    const where = this.buildStatWhereClause(filters);

    // Execute all counts in parallel
    const [
      total,
      pending,
      processing,
      completed,
      failed,
      cancelled,
      avgAggregateResult
    ] = await Promise.all([
      this.prisma.pdfGenerationJob.count({ where }),
      this.prisma.pdfGenerationJob.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.pdfGenerationJob.count({ where: { ...where, status: 'PROCESSING' } }),
      this.prisma.pdfGenerationJob.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.pdfGenerationJob.count({ where: { ...where, status: 'FAILED' } }),
      this.prisma.pdfGenerationJob.count({ where: { ...where, status: 'CANCELLED' } }),
      
      this.prisma.pdfGenerationJob.aggregate({
        where: {
          ...where,
          status: 'COMPLETED',
          startedAt: { not: null },
          completedAt: { not: null },
        },
        _avg: {
          priority: true,
          attempts: true,
          maxAttempts: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    // Calculate average processing time
    const avgTimeInSeconds = avgAggregateResult._count._all > 0 
      ? await this.calculateAvgProcessingTime(where)
      : null;

    // Get template stats only if templateId filter is not provided
    let byTemplate: Array<{
      templateId: string;
      templateName: string;
      count: number;
      successRate: number;
    }> = [];
    
    if (!filters.templateId) {
      const byTemplateStats = await this.getStatsByTemplate(where);
      
      // Calculate success rates for each template
      byTemplate = await Promise.all(
        byTemplateStats.map(async (template) => ({
          templateId: template.templateId,
          templateName: template.templateName,
          count: template.count,
          successRate: await this.calculateTemplateSuccessRate(template.templateId, where),
        }))
      );
    }

    // Get other stats in parallel for better performance
    const [
      byPriority,
      byHour,
      avgProcessingByPriority,
      avgProcessingByStatus,
      failureReasons,
      byPeriod
    ] = await Promise.all([
      this.getStatsByPriority(where),
      this.getStatsByHour(where, filters.period),
      this.getAvgProcessingTimeByPriority(where),
      this.getAvgProcessingTimeByStatus(where),
      this.getFailureReasons(where),
      filters.period && filters.period !== 'all' 
        ? this.getStatsByPeriod(where, filters.period)
        : Promise.resolve([]),
    ]);

    // Build the JobStats object
    const stats: JobStats = {
      totalJobs: total,
      byStatus: {
        PENDING: pending,
        PROCESSING: processing,
        COMPLETED: completed,
        FAILED: failed,
        CANCELLED: cancelled,
        TIMEOUT: 0, // Add if you want to track timeout status
      },
      byPriority,
      byTemplate: byTemplate.length > 0 ? byTemplate : undefined,
      byHour: byHour.length > 0 ? byHour : undefined,
      byPeriod: byPeriod.length > 0 ? byPeriod : undefined, // Optional
      averageProcessingTimes: {
        overall: avgTimeInSeconds || 0,
        byPriority: avgProcessingByPriority,
        byStatus: avgProcessingByStatus,
      },
      failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
    };

    return stats;
  } catch (error) {
    this.logger.error('Failed to get PDF generation job statistics', error);
    throw new PdfGenerationJobError(
      'GET_STATS_FAILED',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

// Updated helper methods with proper typing
 private async calculateAvgProcessingTime(where: Prisma.PdfGenerationJobWhereInput): Promise<number | null> {
  try {
    const result = await this.prisma.$queryRaw<RawAvgProcessingTimeResult[]>`
      SELECT 
        AVG(
          EXTRACT(EPOCH FROM ("completed_at" - "started_at"))
        ) as avg_processing_time
      FROM "pdfs"."pdf_generation_jobs"
      WHERE 
        status = 'COMPLETED' 
        AND "started_at" IS NOT NULL 
        AND "completed_at" IS NOT NULL
        ${where.templateId ? Prisma.sql`AND "template_id"::uuid = ${where.templateId}::uuid` : Prisma.empty}
    `;
    return result[0]?.avg_processing_time || null;
  } catch (error) {
    this.logger.warn('Failed to calculate average processing time', error);
    return null;
  }
}

private async getStatsByTemplate(where: Prisma.PdfGenerationJobWhereInput): Promise<Array<{
  templateId: string;
  templateName: string;
  templateTitle: string;
  count: number;
}>> {
  try {
    // Define types for groupBy results
    type GroupByResult = {
      templateId: string;
      _count: {
        _all: number;
      };
    };

    type TemplateInfo = {
      id: string;
      name: string;
      title: string;
    };

    // Get grouped results
    const results = await this.prisma.pdfGenerationJob.groupBy({
      by: ['templateId'],
      where,
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          templateId: 'desc',
        },
      },
      take: 10,
    });

    const typedResults = results as GroupByResult[];

    // Get template names
    const templateIds = typedResults.map((r: GroupByResult) => r.templateId);
    
    const templates = await this.prisma.pdfTemplate.findMany({
      where: { 
        id: { 
          in: templateIds 
        } 
      },
      select: { 
        id: true, 
        name: true, 
        title: true 
      },
    });

    const typedTemplates = templates as TemplateInfo[];

    // Create a map for quick lookup
    const templateMap = new Map<string, TemplateInfo>();
    typedTemplates.forEach((template: TemplateInfo) => {
      templateMap.set(template.id, template);
    });

    // Map results with template info
    return typedResults.map((result: GroupByResult) => {
      const template = templateMap.get(result.templateId);
      
      return {
        templateId: result.templateId,
        templateName: template?.name || 'Unknown',
        templateTitle: template?.title || 'Unknown',
        count: result._count._all,
      };
    });

  } catch (error) {
    this.logger.warn('Failed to get stats by template', error);
    return [];
  }
}

// Updated buildStatsWhereClause to match interface
private buildStatsWhereClause(filters: JobStatsFilters): StatsWhereClause {
  const where: StatsWhereClause = {};

  if (filters.templateId) {
    where.templateId = filters.templateId;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  // Apply date range
  if (filters.fromDate || filters.toDate || filters.period) {
    where.createdAt = {};
    
    if (filters.fromDate) {
      where.createdAt.gte = filters.fromDate;
    } else if (filters.period && filters.period !== 'all') {
      const fromDate = this.getPeriodStartDate(filters.period);
      where.createdAt.gte = fromDate;
    }
    
    if (filters.toDate) {
      where.createdAt.lte = filters.toDate;
    }
  }

  return where;
}
private buildStatWhereClause(filters: JobStatsFilters): Prisma.PdfGenerationJobWhereInput {
  const where: Prisma.PdfGenerationJobWhereInput = {};

  if (filters.templateId) {
    where.templateId = filters.templateId;
  }

  if (filters.userId) {
    where.template = {
      userId: filters.userId
    };
  }

  // Apply date range
  if (filters.fromDate || filters.toDate || filters.period) {
    where.createdAt = {};
    
    if (filters.fromDate) {
      where.createdAt.gte = filters.fromDate;
    } else if (filters.period && filters.period !== 'all') {
      const fromDate = this.getPeriodStartDate(filters.period);
      where.createdAt.gte = fromDate;
    }
    
    if (filters.toDate) {
      where.createdAt.lte = filters.toDate;
    }
  }

  return where;
}

private async getStatsByPriority(where: Prisma.PdfGenerationJobWhereInput): Promise<Record<number, number>> {
  try {
    const results = await this.prisma.pdfGenerationJob.groupBy({
      by: ['priority'],
      where,
      _count: {
        _all: true,
      },
    });

    const priorityStats: Record<number, number> = {};
    results.forEach((result: { priority: string | number; _count: { _all: number; }; }) => {
      const p = Number(result.priority);
      priorityStats[p] = result._count._all;
    });

    return priorityStats;
  } catch (error) {
    this.logger.warn('Failed to get stats by priority', error);
    return {};
  }
}

 private async getStatsByHour(
  where: Prisma.PdfGenerationJobWhereInput, 
  period?: string
): Promise<Array<{ hour: string; count: number; successCount: number }>> {
  try {
    // Determine the date format based on period
    let dateFormat: string;
    let truncFunction: string;
        const filters =  extractFilterValues(where);

    switch (period) {
      case 'day':
        truncFunction = 'DATE_TRUNC(\'hour\', "created_at")';
        dateFormat = 'YYYY-MM-DD HH24:00';
        break;
      case 'week':
      case 'month':
      case 'year':
        truncFunction = 'DATE("created_at")';
        dateFormat = 'YYYY-MM-DD';
        break;
      default:
        truncFunction = 'DATE_TRUNC(\'hour\', "created_at")';
        dateFormat = 'YYYY-MM-DD HH24:00';
    }

    // Build the query without parameters array
    const queryParts: string[] = [
      `SELECT`,
      `TO_CHAR(${truncFunction}, '${dateFormat}') as hour,`,
      `COUNT(*) as count,`,
      `SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as success_count`,
      `FROM "pdfs"."pdf_generation_jobs"`
    ];

    const conditions: string[] = [];
    if (filters.templateId) {
      conditions.push(`"template_id" = '${escapeSqlValue(filters.templateId)}'`);
    }
    
    if (filters.userId) {
      conditions.push(`"user_id" = '${escapeSqlValue(filters.userId)}'`);
    }
    
    if (filters.fromDate) {
      conditions.push(`"created_at" >= '${filters.fromDate.toISOString()}'`);
    }
    
    if (filters.toDate) {
      conditions.push(`"created_at" <= '${filters.toDate.toISOString()}'`);
    }


    if (conditions.length > 0) {
      queryParts.push(`WHERE ${conditions.join(' AND ')}`);
    }

    queryParts.push(`GROUP BY ${truncFunction}`);
    queryParts.push(`ORDER BY hour DESC`);
    queryParts.push(`LIMIT 24`);

    const queryString = queryParts.join(' ');

    // Define the type for query results
    type HourStatsResult = {
      hour: string;
      count: bigint;
      success_count: bigint;
    };

    // Execute query
    const sqlQuery = Prisma.raw(queryString);
    const results = await this.prisma.$queryRaw(sqlQuery) as HourStatsResult[];

    return results.map((row: HourStatsResult) => ({
      hour: row.hour,
      count: Number(row.count),
      successCount: Number(row.success_count),
    }));
  } catch (error) {
    this.logger.warn('Failed to get stats by hour', error);
    return [];
  }
}


 private async calculateTemplateSuccessRate(templateId: string, where: Prisma.PdfGenerationJobWhereInput): Promise<number> {
  try {
    const [completedCount, failedCount] = await Promise.all([
      this.prisma.pdfGenerationJob.count({
        where: {
          ...where,
          templateId,
          status: 'COMPLETED',
        },
      }),
      this.prisma.pdfGenerationJob.count({
        where: {
          ...where,
          templateId,
          status: 'FAILED',
        },
      }),
    ]);

    const total = completedCount + failedCount;
    return total > 0 ? Math.round((completedCount / total) * 100) : 100; // 100% if no failures
  } catch (error) {
    this.logger.warn(`Failed to calculate success rate for template ${templateId}`, error);
    return 0;
  }
}
 private async getAvgProcessingTimeByPriority(where: Prisma.PdfGenerationJobWhereInput): Promise<Record<number, number>> {
  try {
    // Use Prisma.sql template with proper parameter passing
    const query = Prisma.sql`
      SELECT 
        priority,
        AVG(
          EXTRACT(EPOCH FROM ("completed_at" - "started_at"))
        ) as avg_processing_time
      FROM "pdfs"."pdf_generation_jobs"
      WHERE 
        status = 'COMPLETED' 
        AND "started_at" IS NOT NULL 
        AND "completed_at" IS NOT NULL
        ${where.templateId ? Prisma.sql`AND "template_id"::uuid = ${where.templateId}::uuid` : Prisma.empty}
        ${where.userId ? Prisma.sql`AND "user_id"::uuid = ${where.userId}::uuid` : Prisma.empty}
        
      GROUP BY priority
      ORDER BY priority
    `;

    // Define type for query result
    type ProcessingTimeResult = {
      priority: number;
      avg_processing_time: number;
    };

 const results = await this.prisma.$queryRaw(query) as ProcessingTimeResult[];

    const avgTimes: Record<number, number> = {};
    results.forEach((row: ProcessingTimeResult) => {
      avgTimes[row.priority] = row.avg_processing_time || 0;
    });

    return avgTimes;
  } catch (error) {
    this.logger.warn('Failed to get average processing time by priority', error);
    return {};
  }
}
 
   
 private async getAvgProcessingTimeByStatus(where: Prisma.PdfGenerationJobWhereInput): Promise<Record<JobStatus, number>> {
  try {
    // Only calculate for statuses that have both start and completion times
    const validStatuses: JobStatus[] = ['COMPLETED'];
    
    const avgTimes: Record<JobStatus, number> = {} as Record<JobStatus, number>;
    
    // Initialize all statuses with 0
    const allStatuses: JobStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'];
    allStatuses.forEach(status => {
      avgTimes[status] = 0;
    });

    // Calculate for COMPLETED jobs
    if (validStatuses.includes('COMPLETED')) {
      const result = await this.prisma.$queryRaw<Array<{
        avg_processing_time: number;
      }>>`
        SELECT 
          AVG(
            EXTRACT(EPOCH FROM ("completed_at" - "started_at"))
          ) as avg_processing_time
        FROM "pdfs"."pdf_generation_jobs"
        WHERE 
          status = 'COMPLETED' 
          AND "started_at" IS NOT NULL 
          AND "completed_at" IS NOT NULL
          ${where.templateId ? Prisma.sql`AND "template_id"::uuid = ${where.templateId}::uuid` : Prisma.empty}
          ${where.userId ? Prisma.sql`AND "user_id"::uuid = ${where.userId}::uuid` : Prisma.empty}
       
      `;
 
      avgTimes.COMPLETED = result[0]?.avg_processing_time || 0;
    }

    return avgTimes;
  } catch (error) {
    this.logger.warn('Failed to get average processing time by status', error);
    return {} as Record<JobStatus, number>;
  }
}

private async getFailureReasons(where: Prisma.PdfGenerationJobWhereInput): Promise<Array<{
  error: string;
  count: number;
  percentage: number;
}>> {
  try {
    const failedJobs = await this.prisma.pdfGenerationJob.findMany({
      where: {
        ...where,
        status: 'FAILED',
        errorMessage: { not: null },
      },
      select: {
        errorMessage: true,
      },
    });

    // Group and count error messages
    const errorCounts: Record<string, number> = {};
    failedJobs.forEach((job: { errorMessage: string; }) => {
      const error = job.errorMessage || 'Unknown error';
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    });

    const totalFailed = failedJobs.length;
    return Object.entries(errorCounts).map(([error, count]) => ({
      error,
      count,
      percentage: totalFailed > 0 ? Math.round((count / totalFailed) * 100) : 0,
    }));
  } catch (error) {
    this.logger.warn('Failed to get failure reasons', error);
    return [];
  }
}
 

 private async getStatsByPeriod(where: Prisma.PdfGenerationJobWhereInput, period: string): Promise<PeriodStats[]> {
  try {
    let groupBy: string;
    let dateFormat: string;
    
    switch (period) {
      case 'hour':
        groupBy = `DATE_TRUNC('hour', "created_at")`;
        dateFormat = 'YYYY-MM-DD HH24:00';
        break;
      case 'day':
        groupBy = `DATE("created_at")`;
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        groupBy = `DATE_TRUNC('week', "created_at")`;
        dateFormat = 'IYYY-"W"IW';
        break;
      case 'month':
        groupBy = `DATE_TRUNC('month', "created_at")`;
        dateFormat = 'YYYY-MM';
        break;
      case 'year':
        groupBy = `DATE_TRUNC('year', "created_at")`;
        dateFormat = 'YYYY';
        break;
      default:
        groupBy = `DATE("created_at")`;
        dateFormat = 'YYYY-MM-DD';
    }

    // Define type for raw query result
    type RawStatsResult = {
      period: string;
      count: bigint;
      completed: bigint;
      failed: bigint;
      cancelled: bigint;
    };

    // Use proper type for the raw query result
    const results = await this.prisma.$queryRaw<RawStatsResult[]>`
      SELECT 
        TO_CHAR(${Prisma.raw(groupBy)}, ${dateFormat}) as period,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
      FROM "pdfs"."pdf_generation_jobs"
      WHERE 1=1
        ${where.templateId ? Prisma.sql`AND "template_id"::uuid = ${where.templateId}::uuid` : Prisma.empty}
        ${where.userId ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "pdfs"."pdf_templates" t 
          WHERE t.id::uuid = "pdf_generation_jobs"."template_id"::uuid 
          AND t.user_id::uuid = ${where.userId}::uuid
        )` : Prisma.empty}
      GROUP BY ${Prisma.raw(groupBy)}
      ORDER BY period DESC
      LIMIT 30
    `;

    // Convert bigint to number with proper typing
    return results.map((row: RawStatsResult): PeriodStats => ({
      period: row.period,
      count: Number(row.count),
      completed: Number(row.completed),
      failed: Number(row.failed),
      cancelled: Number(row.cancelled),
      pending: 0,
      processing: 0,
    }));
  } catch (error) {
    this.logger.warn('Failed to get stats by period', error);
    return [];
  }
}
async updateProgress(jobId: string, progress: JobProgressUpdate): Promise<void> {
  try {
  
  
    await this.prisma.pdfGenerationJob.update({
      where: { id: jobId },
      data: {
      ...(progress.metadata && { options: { ...(progress.metadata ?? {}) } }),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    throw new PdfGenerationJobError(
      'UPDATE_PROGRESS_FAILED',
      `Failed to update progress for job ${jobId}`,
      error instanceof Error ? error : undefined
    );
  }
}

async retryJob(id: string, options?: RetryJobOptions): Promise<PdfGenerationJob> {
  try {
    // Get the current job
    const currentJob = await this.prisma.pdfGenerationJob.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            title: true,
          },
        },
      },
    });

    if (!currentJob) {
      throw new PdfGenerationJobError(
        'JOB_NOT_FOUND',
        `Job with ID ${id} not found`
      );
    }

    // Create retry metadata
    const retryMetadata = {
      ...(typeof currentJob.metadata === 'object' ? currentJob.metadata : {}),
      retryInfo: {
        originalJobId: id,
        retryCount: (currentJob.attempts || 0) + 1,
        lastError: currentJob.errorMessage,
        retriedAt: new Date(),
      },
      timing: {
        ...(typeof currentJob.metadata === 'object' && currentJob.metadata.timing),
        retriedAt: new Date(),
      },
    };

    // Update the current job to mark it as retried
    await this.prisma.pdfGenerationJob.update({
      where: { id },
      data: {
        status: 'RETRYING',
        //metadata: retryMetadata,
        options: {
  ...(currentJob.options ?? {}),
  retryMetadata,
},
        updatedAt: new Date(),
      },
    });

    // Create a new job entry for the retry
    const retryJob = await this.prisma.pdfGenerationJob.create({
  data: {
    templateId: currentJob.templateId,
    userId: currentJob.userId,
    organizationId: currentJob.organizationId,
    data: currentJob.data,
    options: {
      ...(currentJob.options ?? {}),
      retryMetadata: {
        ...retryMetadata,
        parentJobId: id,
        originalJobStatus: currentJob.status,
        retryReason: 'Manual retry',
      },
    },
    status: 'PENDING',
    priority: options?.newPriority ?? currentJob.priority,
    attempts: 0,
    maxAttempts: options?.maxAttempts ?? currentJob.maxAttempts,
    callbackUrl: currentJob.callbackUrl,
    scheduledAt: options?.delay ? new Date(Date.now() + options.delay) : new Date(),
  },
});


    return this.mapToDomain(retryJob);
  } catch (error) {
    if (error instanceof PdfGenerationJobError) {
      throw error;
    }
    throw new PdfGenerationJobError(
      'RETRY_JOB_FAILED',
      `Failed to retry job ${id}`,
      error instanceof Error ? error : undefined
    );
  }
}

async markAsProcessing(id: string, workerId: string): Promise<PdfGenerationJob> {
  try {
    const job = await this.prisma.pdfGenerationJob.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        workerId,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            title: true,
          },
        },
      },
    });
    return this.mapToDomain(job);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new PdfGenerationJobError(
        'JOB_NOT_FOUND',
        `Job with ID ${id} not found`
      );
    }
    throw new PdfGenerationJobError(
      'MARK_AS_PROCESSING_FAILED',
      `Failed to mark job ${id} as processing`,
      error instanceof Error ? error : undefined
    );
  }
}

async markAsCompleted(id: string, documentId: string): Promise<PdfGenerationJob> {
  try {
    const job = await this.prisma.pdfGenerationJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        documentId,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            title: true,
          },
        },
        document: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            pageCount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    return this.mapToDomain(job);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new PdfGenerationJobError(
          'JOB_NOT_FOUND',
          `Job with ID ${id} not found`
        );
      }
      if (error.code === 'P2003') {
        throw new PdfGenerationJobError(
          'DOCUMENT_NOT_FOUND',
          `Document with ID ${documentId} not found`
        );
      }
    }
    throw new PdfGenerationJobError(
      'MARK_AS_COMPLETED_FAILED',
      `Failed to mark job ${id} as completed`,
      error instanceof Error ? error : undefined
    );
  }
}

async markAsFailed(id: string, error: Error): Promise<PdfGenerationJob> {
  try {
    const job = await this.prisma.pdfGenerationJob.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage: error.message.substring(0, 500), // Limit to 500 chars
        errorStack: error.stack?.substring(0, 2000), // Limit to 2000 chars
        attempts: { increment: 1 },
        completedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            title: true,
          },
        },
      },
    });
    return this.mapToDomain(job);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new PdfGenerationJobError(
        'JOB_NOT_FOUND',
        `Job with ID ${id} not found`
      );
    }
    throw new PdfGenerationJobError(
      'MARK_AS_FAILED_FAILED',
      `Failed to mark job ${id} as failed`,
      error instanceof Error ? error : undefined
    );
  }
}

async cleanupExpiredJobs(): Promise<{ deleted: number }> {
  try {
    // Find jobs that have timed out or expired
    const now = new Date();
    const expiredJobs = await this.prisma.pdfGenerationJob.findMany({
      where: {
        OR: [
          // Jobs with timeout that have passed
          {
            timeoutAt: { not: null, lt: now },
            status: { in: ['PENDING', 'PROCESSING'] },
          },
          // Failed jobs with max attempts reached
          {
            status: 'FAILED',
            attempts: { gte: Prisma.sql`"maxAttempts"` },
          },
          // Jobs that have been pending for too long (24 hours)
          {
            status: 'PENDING',
            createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        ],
      },
      select: { id: true },
    });

    const jobIds = expiredJobs.map((job: { id: string; }) => job.id);
    
    if (jobIds.length === 0) {
      return { deleted: 0 };
    }

    // Update expired jobs status
    const result = await this.prisma.pdfGenerationJob.updateMany({
      where: { id: { in: jobIds } },
      data: {
        status: 'TIMEOUT',
        errorMessage: 'Job expired or timed out',
        completedAt: now,
        updatedAt: now,
      },
    });

    return { deleted: result.count };
  } catch (error) {
    this.logger.error('Failed to cleanup expired jobs', error);
    throw new PdfGenerationJobError(
      'CLEANUP_FAILED',
      'Failed to cleanup expired jobs',
      error instanceof Error ? error : undefined
    );
  }
}

 async getQueueStats(): Promise<QueueStats> {
  try {
    const now = new Date();
    
    // Define types for groupBy results
    type StatusCountResult = {
      status: string;
      _count: {
        _all: number;
      };
    };

    type PriorityCountResult = {
      priority: number;
      _count: {
        _all: number;
      };
    };

    // Get counts by status
    const counts = await this.prisma.pdfGenerationJob.groupBy({
      by: ['status'],
      _count: { _all: true },
    }) as StatusCountResult[];

    // Get counts by priority
    const priorityCounts = await this.prisma.pdfGenerationJob.groupBy({
      by: ['priority'],
      _count: { _all: true },
      orderBy: { priority: 'asc' },
    }) as PriorityCountResult[];

    // Get oldest pending job
    const oldestPendingJob = await this.prisma.pdfGenerationJob.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    // Calculate average processing time for completed jobs
    type AvgProcessingTimeResult = {
      avg_processing_time: number;
    };

    const avgProcessingTimeResult = await this.prisma.$queryRaw<AvgProcessingTimeResult[]>`
  SELECT 
    AVG(
      EXTRACT(EPOCH FROM ("completed_at" - "started_at"))
    ) as avg_processing_time
  FROM "pdfs"."pdf_generation_jobs"
  WHERE 
    status = 'COMPLETED' 
    AND "started_at" IS NOT NULL 
    AND "completed_at" IS NOT NULL
`;

    // Calculate total jobs
    const totalJobs = counts.reduce((sum: number, item: StatusCountResult) => 
      sum + item._count._all, 0
    );

    // Find counts by status
    const findCountByStatus = (status: string): number => {
      const found = counts.find((item: StatusCountResult) => item.status === status);
      return found?._count._all || 0;
    };

    // Build stats object
    const stats: QueueStats = {
      totalJobs,
      pending: findCountByStatus('PENDING'),
      processing: findCountByStatus('PROCESSING'),
      completed: findCountByStatus('COMPLETED'),
      failed: findCountByStatus('FAILED'),
      cancelled: findCountByStatus('CANCELLED'),
      timeout: findCountByStatus('TIMEOUT'),
      byPriority: priorityCounts.map((item: PriorityCountResult) => ({
        priority: item.priority,
        count: item._count._all,
      })),
      byStatus: counts.map((item: StatusCountResult) => ({
        status: item.status as JobStatus,
        count: item._count._all,
      })),
      averageProcessingTime: avgProcessingTimeResult[0]?.avg_processing_time || 0,
      oldestPendingJob: oldestPendingJob?.createdAt,
      estimatedCompletionTime: this.calculateEstimatedCompletionTime(counts, priorityCounts),
    };

    return stats;
  } catch (error) {
    this.logger.error('Failed to get queue stats', error);
    throw new PdfGenerationJobError(
      'GET_QUEUE_STATS_FAILED',
      'Failed to get queue statistics',
      error instanceof Error ? error : undefined
    );
  }
}

// Also update the helper method signature
private calculateEstimatedCompletionTime(
  statusCounts: StatusCountResult[],
  priorityCounts: PriorityCountResult[]
): Date | undefined {
  const pendingCount = statusCounts.find((item: StatusCountResult) => 
    item.status === 'PENDING'
  )?._count._all || 0;
  
  const processingCount = statusCounts.find((item: StatusCountResult) => 
    item.status === 'PROCESSING'
  )?._count._all || 0;
  
  if (pendingCount === 0 && processingCount === 0) {
    return undefined;
  }

  // Simple estimation: assume average 30 seconds per job
  const estimatedSeconds = (pendingCount + processingCount) * 30;
  const estimatedDate = new Date(Date.now() + estimatedSeconds * 1000);
  
  return estimatedDate;
}

 
 
private getPeriodStartDate(period?: StatsPeriod | string): Date {
  const now = new Date();
  const fromDate = new Date(now);
  
  switch (period) {
    case 'hour':
      fromDate.setHours(now.getHours() - 1);
      break;
    case 'day':
      fromDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      fromDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      fromDate.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      fromDate.setFullYear(now.getFullYear() - 1);
      break;
    case 'custom':
    case 'all':
    default:
      return new Date(0); // Beginning of time for 'all' or unsupported/custom periods
  }
  
  return fromDate;
}
 
 private buildWhereClause(filters?: PdfGenerationJobFilters): Prisma.PdfGenerationJobWhereInput {
  const where: Prisma.PdfGenerationJobWhereInput = {};

  if (filters?.templateId) {
    where.templateId = filters.templateId;
  }

  if (filters?.status) {
    // Ensure status is a valid JobStatus enum value
    const validStatuses:  JobStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'];
    if (validStatuses.includes(filters.status as  JobStatus)) {
      where.status = filters.status as  JobStatus;
    }
  }

  if (filters?.priority !== undefined) {
    where.priority = filters.priority;
  }

  // Handle date range
  if (filters?.fromDate || filters?.toDate) {
    where.createdAt = {};
    
    if (filters.fromDate) {
      where.createdAt.gte = filters.fromDate;
    }
    
    if (filters.toDate) {
      where.createdAt.lte = filters.toDate;
    }
  }

  // Handle search if provided (search in related fields)
  if (filters?.search) {
    where.OR = [
      { template: { name: { contains: filters.search, mode: 'insensitive' } } },
      { template: { title: { contains: filters.search, mode: 'insensitive' } } },
      { errorMessage: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

private buildOrderBy(pagination?: PaginationOptions): Prisma.PdfGenerationJobOrderByWithRelationInput {
  const defaultOrderBy: Prisma.PdfGenerationJobOrderByWithRelationInput = { createdAt: 'desc' };
  
  if (!pagination?.sortBy) {
    return defaultOrderBy;
  }
  
  const { sortBy, sortOrder = 'desc' } = pagination;
  
 
  const validatedSortOrder: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
  
  return { [sortBy]: validatedSortOrder } as Prisma.PdfGenerationJobOrderByWithRelationInput;
}

 

private mapToDomain(prismaJob: PrismaPdfGenerationJobWithRelations): PdfGenerationJob {
  
  // Parse all JSON fields
  const data = parseJsonField<TemplateData>(prismaJob.data) ?? {};
  const options = parseJsonField<JobOptions>(prismaJob.options);
  const metadata = parseJsonField<JobMetadata>(prismaJob);
  
  // Parse template config if template exists
  const templateConfig = prismaJob.template?.config 
    ? parseJsonField<PdfTemplateConfig>(prismaJob.template.config) 
    : null;
  
  // Parse document variables if document exists
  const documentVariables = prismaJob.document?.variables
    ? parseJsonField<TemplateVariables>(prismaJob.document.variables)
    : null;

  // Build template object
  const template = prismaJob.template ? {
    id: prismaJob.template.id,
    name: prismaJob.template.name,
    title: prismaJob.template.title,
    config: templateConfig,
    userId: prismaJob.template.userId,
    organizationId: prismaJob.template.organizationId,
    isActive: prismaJob.template.isActive,
    isPublic: prismaJob.template.isPublic,
    version: prismaJob.template.version,
  } : undefined;

  // Build document object
  const document = prismaJob.document ? {
    id: prismaJob.document.id,
    fileName: prismaJob.document.fileName,
    fileUrl: prismaJob.document.fileUrl,
    fileSize: prismaJob.document.fileSize,
    pageCount: prismaJob.document.pageCount,
    status: prismaJob.document.status,
    createdAt: prismaJob.document.createdAt,
    updatedAt: prismaJob.document.updatedAt,
    expiresAt: prismaJob.document.expiresAt,
    isPreview: prismaJob.document.isPreview,
    variables: documentVariables,
  } : null;

  // Calculate progress based on status
  const progress =  calculateJobProgress(prismaJob);

  return {
    id: prismaJob.id,
    templateId: prismaJob.templateId,
    userId: prismaJob.userId!,
    organizationId: prismaJob.organizationId ?? null,
    template,
    estimatedCompletionTime: null,  
    data,
    options,
    progress,
    status: prismaJob.status as JobStatus,
    priority: prismaJob.priority,
    attempts: prismaJob.attempts,
    maxAttempts: prismaJob.maxAttempts,
    documentId: prismaJob.documentId,
    document,
    errorMessage: prismaJob.errorMessage,
    errorStack: prismaJob.errorStack,
    callbackUrl: prismaJob.callbackUrl,
    scheduledAt: prismaJob.scheduledAt,
    startedAt: prismaJob.startedAt,
    completedAt: prismaJob.completedAt,
    timeoutAt: prismaJob.timeoutAt,
    queueName: prismaJob.queueName,
    workerId: prismaJob.workerId,
    metadata,
    createdAt: prismaJob.createdAt,
    updatedAt: prismaJob.updatedAt,
  };
}

 

}