
import type { FastifyInstance } from 'fastify';
import type { PreHandler } from '../types.js';
import { CreatePdfGenerationJobUseCase } from '@application/use-cases/pdf-jobs/create-pdf-generation-job.usecase.js';
import { GetPdfGenerationJobUseCase } from '@application/use-cases/pdf-jobs/get-pdf-generation-job.usecase.js';
import { ListPdfGenerationJobsUseCase } from '@application/use-cases/pdf-jobs/list-pdf-generation-jobs.usecase.js';
import { CancelPdfGenerationJobUseCase } from '@application/use-cases/pdf-jobs/cancel-pdf-generation-job.usecase.js';
import { CreatePdfJobData, JobStatus } from '@application/dto/pdf-job.dto.js';
import { PdfGenerationJob } from '@domain/entities/pdf-generation-job.entity.js';
import { DomainError } from '@domain/errors/index.js';
import { calculateProgress } from '@shared/pdfjob/pdf-generation.js';
import { PdfGenerationJobFilters } from '@application/interfaces/pdf-generation-job-repository.js';
import { AllowedSort, isValidSort } from '@shared/utils/validateData.js';
 
 

interface PdfJobDependencies {
  createPdfGenerationJobUseCase: CreatePdfGenerationJobUseCase;
  getPdfGenerationJobUseCase: GetPdfGenerationJobUseCase;
  listPdfGenerationJobsUseCase: ListPdfGenerationJobsUseCase;
  cancelPdfGenerationJobUseCase: CancelPdfGenerationJobUseCase;
  requireAuth: PreHandler;
}

export async function pdfJobRoutes(
  fastify: FastifyInstance,
  deps: PdfJobDependencies
) {

  fastify.post<{ Body: CreatePdfJobData }>(
    '/',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Jobs'],
        summary: 'Create PDF generation job',
        description: 'Create an asynchronous PDF generation job.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['templateId', 'data'],
          properties: {
            templateId: { 
              type: 'string', 
              format: 'uuid',
              description: 'ID of the PDF template to use'
            },
            data: { 
              type: 'object', 
              additionalProperties: true,
              description: 'Data to populate the PDF template'
            },
            options: {
              type: 'object',
              properties: {
                quality: { 
                  type: 'string', 
                  enum: ['low', 'medium', 'high'], 
                  default: 'medium',
                  description: 'PDF quality setting'
                },
                includeMetadata: { 
                  type: 'boolean', 
                  default: true,
                  description: 'Include metadata in PDF'
                },
                filename: { 
                  type: 'string',
                  description: 'Custom filename for the PDF'
                },
                priority: { 
                  type: 'number', 
                  minimum: 0, 
                  maximum: 2, 
                  default: 0,
                  description: 'Job priority (0=normal, 1=high, 2=urgent)'
                },
                callbackUrl: { 
                  type: 'string', 
                  format: 'uri',
                  description: 'Webhook URL to notify when job completes'
                },
                maxAttempts: { 
                  type: 'number', 
                  minimum: 1, 
                  maximum: 10, 
                  default: 3,
                  description: 'Maximum number of generation attempts'
                },
                timeoutSeconds: { 
                  type: 'number', 
                  minimum: 30, 
                  maximum: 600, 
                  default: 120,
                  description: 'Job timeout in seconds'
                },
                metadata: { 
                  type: 'object',
                  description: 'Additional metadata for the job'
                },
              },
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  templateId: { type: 'string', format: 'uuid' },
                  status: { type: 'string' },
                  priority: { type: 'number' },
                  estimatedCompletionTime: { type: 'string', format: 'date-time', nullable: true },
                  jobUrl: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const { templateId, data, options } = request.body;

      const result = await deps.createPdfGenerationJobUseCase.execute(
        userId,
        templateId,
        data,
        organizationId,
        options
      );


      const jobResponse = {
        ...result,
        jobUrl: `/api/v1/pdf/jobs/${result.id}`,
      };

      return reply.status(201).send({ data: jobResponse });
    }
  );


  fastify.get(
    '/',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Jobs'],
        summary: 'List PDF generation jobs',
        description: 'List asynchronous PDF generation jobs for the authenticated user.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            templateId: { type: 'string', format: 'uuid' },
            status: { 
              type: 'string', 
              enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'],
              description: 'Filter by job status'
            },
            priority: { type: 'string', description: 'Filter by priority (0,1,2)' },
            fromDate: { type: 'string', format: 'date-time' },
            toDate: { type: 'string', format: 'date-time' },
            sortBy: { 
              type: 'string', 
              enum: ['createdAt', 'priority', 'status'], 
              default: 'createdAt' 
            },
            sortOrder: { 
              type: 'string', 
              enum: ['asc', 'desc'], 
              default: 'desc' 
            },
            page: { type: 'string', default: '1', description: 'Page number' },
            limit: { type: 'string', default: '20', description: 'Items per page (max 100)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    templateId: { type: 'string', format: 'uuid' },
                    templateName: { type: 'string' },
                    status: { type: 'string' },
                    priority: { type: 'number' },
                    attempts: { type: 'number' },
                    maxAttempts: { type: 'number' },
                    documentId: { type: 'string', format: 'uuid', nullable: true },
                    errorMessage: { type: 'string', nullable: true },
                    scheduledAt: { type: 'string', format: 'date-time', nullable: true },
                    startedAt: { type: 'string', format: 'date-time', nullable: true },
                    completedAt: { type: 'string', format: 'date-time', nullable: true },
                    estimatedCompletionTime: { type: 'string', format: 'date-time', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                  statusCounts: {
                    type: 'object',
                    properties: {
                      PENDING: { type: 'number' },
                      PROCESSING: { type: 'number' },
                      COMPLETED: { type: 'number' },
                      FAILED: { type: 'number' },
                      CANCELLED: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
     const query = request.query as PdfGenerationJobFilters;

      
    const sortBy: AllowedSort = isValidSort(query.sortBy!) 
  ? query.sortBy 
  : 'createdAt';

      const result = await deps.listPdfGenerationJobsUseCase.execute(userId, {
      templateId: query.templateId,
      status: query.status as JobStatus | undefined,  
      priority: query.priority ? parseInt(String(query.priority)) : undefined,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      sortBy,
      sortOrder: (query.sortOrder as 'asc' | 'desc') || 'desc',
      page: parseInt(query.page || '1'),
      limit: Math.min(parseInt(query.limit || '20'), 100),
    }, organizationId);

      return reply.send({
        data: result.items,
        pagination: result.pagination,
      });
    }
  );


  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Jobs'],
        summary: 'Get PDF generation job',
        description: 'Get details of an asynchronous PDF generation job.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  templateId: { type: 'string', format: 'uuid' },
                  template: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      name: { type: 'string' },
                      title: { type: 'string' },
                    },
                  },
                  data: { type: 'object' },
                  options: { type: 'object' },
                  status: { type: 'string' },
                  priority: { type: 'number' },
                  attempts: { type: 'number' },
                  maxAttempts: { type: 'number' },
                  documentId: { type: 'string', format: 'uuid', nullable: true },
                  document: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      fileName: { type: 'string' },
                      fileSize: { type: 'number' },
                      fileUrl: { type: 'string' },
                      status: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                    nullable: true,
                  },
                  errorMessage: { type: 'string', nullable: true },
                  errorStack: { type: 'string', nullable: true },
                  callbackUrl: { type: 'string', format: 'uri', nullable: true },
                  scheduledAt: { type: 'string', format: 'date-time', nullable: true },
                  startedAt: { type: 'string', format: 'date-time', nullable: true },
                  completedAt: { type: 'string', format: 'date-time', nullable: true },
                  timeoutAt: { type: 'string', format: 'date-time', nullable: true },
                  estimatedCompletionTime: { type: 'string', format: 'date-time', nullable: true },
                  queueName: { type: 'string', nullable: true },
                  workerId: { type: 'string', nullable: true },
                  metadata: { type: 'object', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const { id } = request.params;

      const result = await deps.getPdfGenerationJobUseCase.execute(
        userId,
        id,
        organizationId
      );

      return reply.send({ data: result });
    }
  );


  fastify.post<{ Params: { id: string } }>(
    '/:id/cancel',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Jobs'],
        summary: 'Cancel PDF generation job',
        description: 'Cancel an asynchronous PDF generation job.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  status: { type: 'string' },
                  cancelledAt: { type: 'string', format: 'date-time' },
                  message: { type: 'string' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const { id } = request.params;

      const result = await deps.cancelPdfGenerationJobUseCase.execute(
        userId,
        id,
        organizationId
      );

      return reply.send({ data: result });
    }
  );


   fastify.post<{ Params: { id: string } }>(
  '/:id/retry',
  {
    preHandler: [deps.requireAuth],
    schema: {
      tags: ['PDF Jobs'],
      summary: 'Retry PDF generation job',
      description: 'Retry a failed or cancelled asynchronous PDF generation job.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                templateId: { type: 'string', format: 'uuid' },
                status: { type: 'string' },
                retryInfo: {
                  type: 'object',
                  properties: {
                    retryCount: { type: 'number' },
                    originalJobId: { type: 'string', format: 'uuid' },
                    originalStatus: { type: 'string' },
                    isRetry: { type: 'boolean' },
                    retriedAt: { type: 'string', format: 'date-time' },
                  },
                },
                message: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  },
  async (request, reply) => {
    const userId = request.user!.sub;
    const organizationId = request.user!.orgId;
    const { id } = request.params;

    try {
      const retryJob = await deps.createPdfGenerationJobUseCase.executeRetry(
        userId,
        id,
        organizationId
      );

      // Extract retry information from OPTIONS (not metadata)
      const retryInfo = retryJob.metadata?.retryInfo || {
        retryCount: 1,
        originalJobId: id,
        originalStatus: 'UNKNOWN',
        isRetry: true,
        retriedAt: new Date().toISOString(),
      };

      return reply.send({ 
        data: {
          id: retryJob.id,
          templateId: retryJob.templateId,
          status: retryJob.status,
          retryInfo,
          message: 'Job retried successfully',
          createdAt: retryJob.createdAt,
        }
      });
    } catch (error) {
      request.log.error('Retry failed:');
      throw error;
    }
  }
);


  fastify.get<{ Params: { id: string } }>(
    '/:id/status',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Jobs'],
        summary: 'Get job status',
        description: 'Get only the status of an asynchronous PDF generation job.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  status: { type: 'string' },
                  progress: { type: 'number', nullable: true },
                  estimatedCompletionTime: { type: 'string', format: 'date-time', nullable: true },
                  documentId: { type: 'string', format: 'uuid', nullable: true },
                  errorMessage: { type: 'string', nullable: true },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const { id } = request.params;

      const job = await deps.getPdfGenerationJobUseCase.execute(
        userId,
        id,
        organizationId
      );


      const statusInfo = {
        id: job.id,
        status: job.status,
        progress:  calculateProgress(job),
        estimatedCompletionTime: job.estimatedCompletionTime,
        documentId: job.documentId,
        errorMessage: job.errorMessage,
        updatedAt: job.updatedAt,
      };

      return reply.send({ data: statusInfo });
    }
  );


  fastify.delete<{ Params: { id: string } }>(
  '/:id',
  {
    preHandler: [deps.requireAuth],
    schema: {
      tags: ['PDF Jobs'],
      summary: 'Delete PDF generation job',
      description: 'Delete an asynchronous PDF generation job.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  },
  async (request, reply) => {
    const userId = request.user!.sub;
    const organizationId = request.user!.orgId;
    const { id } = request.params;

    await deps.cancelPdfGenerationJobUseCase.execute(
      userId,
      id,
      organizationId
    );

    return reply.status(204).send();
  }
);



  fastify.post<{ Body: { jobs: Omit<CreatePdfJobData, 'userId'>[] } }>(
    '/batch',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Jobs'],
        summary: 'Batch create PDF jobs',
        description: 'Create multiple asynchronous PDF generation jobs.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['jobs'],
          properties: {
            jobs: {
              type: 'array',
              minItems: 1,
              maxItems: 100,
              items: {
                type: 'object',
                required: ['templateId', 'data'],
                properties: {
                  templateId: { type: 'string', format: 'uuid' },
                  data: { type: 'object', additionalProperties: true },
                  options: {
                    type: 'object',
                    properties: {
                      quality: { type: 'string', enum: ['low', 'medium', 'high'] },
                      priority: { type: 'number', minimum: 0, maximum: 2 },
                      filename: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const { jobs } = request.body;

      const results = await Promise.all(
        jobs.map(async (job) => {
          try {
            const result = await deps.createPdfGenerationJobUseCase.execute(
              userId,
              job.templateId,
              job.data,
              organizationId,
              job.options
            );
            return { success: true, data: result };
          } 
         catch (error) {
  if (error instanceof DomainError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      templateId: job.templateId,
    };
  }

  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unexpected error',
    templateId: job.templateId,
  };
}


        })
      );

      return reply.status(207).send({ data: results });  
    }
  );


  fastify.get(
    '/stats',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Jobs'],
        summary: 'Get job statistics',
        description: 'Get statistics about PDF generation jobs.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            period: { 
              type: 'string', 
              enum: ['hour', 'day', 'week', 'month', 'year'], 
              default: 'day' 
            },
            templateId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const query = request.query as {
      period?: 'hour' | 'day' | 'week' | 'month' | 'year';
      templateId?: string;
    };

     const stats = await deps.listPdfGenerationJobsUseCase.executeStats(
      userId,
      {
        period: query.period || 'day',
        templateId: query.templateId,
      },
      organizationId
    );

      return reply.send({ data: stats });
    }
  );


  fastify.get(
    '/queue',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Jobs'],
        summary: 'Get queue status',
        description: 'Get status of the job processing queue.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
  console.log("userId",userId)
    console.log("organizationId",organizationId)

      const queueStatus = {
        totalJobs: 0,
        pendingJobs: 0,
        processingJobs: 0,
        activeWorkers: 0,
        avgProcessingTime: 0,
        health: 'healthy',
      };

      return reply.send({ data: queueStatus });
    }
  );
}

 

 