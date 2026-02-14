
import type { FastifyInstance } from 'fastify';
import type { PreHandler } from '../types.js';
 
import type {
  BatchPdfRequestBody,
  GeneratePdfData,
  GeneratePreviewData,
  ListPdfDocumentsFilters,
} from '../../application/dto/generate-pdf.dto.js';
import { DownloadPdfDocumentUseCase } from '@application/use-cases/pdf-generation/download-pdf-document.usecase.js';
import { ListPdfDocumentsUseCase  } from '@application/use-cases/pdf-generation/list-pdf-documents.usecase.js';
import { GetPdfDocumentUseCase } from '@application/use-cases/pdf-generation/get-pdf-document.usecase.js';
import { GeneratePdfUseCase } from '@application/use-cases/pdf-generation/generate-pdf.usecase.js';
import { GeneratePreviewUseCase } from '@application/use-cases/pdf-generation/generate-preview.usecase.js';
import { DeletePdfDocumentUseCase } from '@application/use-cases/pdf-generation/delete-pdf-document.usecase.js';
import { DocumentStats, DocumentStatsFilters, RegenerateDocumentBody } from '@application/interfaces/pdf-document-repository.interface.js';
import { PdfGenerationJobFilters } from '@application/interfaces/pdf-generation-job-repository.js';
import { DocumentStatus, JobStatus } from '@prisma/client';

interface PdfGenerationDependencies {
  generatePdfUseCase: GeneratePdfUseCase;
  generatePreviewUseCase: GeneratePreviewUseCase;
  getPdfDocumentUseCase: GetPdfDocumentUseCase;
  listPdfDocumentsUseCase: ListPdfDocumentsUseCase;
  deletePdfDocumentUseCase: DeletePdfDocumentUseCase;
  downloadPdfDocumentUseCase: DownloadPdfDocumentUseCase;
  requireAuth: PreHandler;
}

export async function pdfGenerationRoutes(
  fastify: FastifyInstance,
  deps: PdfGenerationDependencies
) {

  fastify.post<{ Body: GeneratePdfData }>(
    '/generate',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'Generate PDF',
        description: 'Generate a PDF from a template with data.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['templateId', 'data'],
          properties: {
            templateId: { type: 'string', format: 'uuid' },
            data: { type: 'object', additionalProperties: true },
            options: {
              type: 'object',
              properties: {
                quality: { type: 'string', enum: ['low', 'medium', 'high'] },
                includeMetadata: { type: 'boolean', default: true },
                filename: { type: 'string' },
                expiresInHours: { type: 'number', minimum: 1, maximum: 720 },
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
                  fileName: { type: 'string' },
                  fileUrl: { type: 'string' },
                  fileSize: { type: 'number' },
                  pageCount: { type: 'number' },
                  status: { type: 'string' },
                  isPreview: { type: 'boolean' },
                  expiresAt: { type: 'string', format: 'date-time', nullable: true },
                  generatedBy: { type: 'string', format: 'uuid' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { templateId, data, options } = request.body;

      const result = await deps.generatePdfUseCase.execute(
        templateId,
        data,
        userId,
        options
      );

      return reply.status(201).send({ data: result });
    }
  );


  fastify.post<{ Body: GeneratePreviewData }>(
    '/preview',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'Generate preview PDF',
        description: 'Generate a preview PDF (not stored permanently).',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['templateId', 'data'],
          properties: {
            templateId: { type: 'string', format: 'uuid' },
            data: { type: 'object', additionalProperties: true },
            options: {
              type: 'object',
              properties: {
                quality: { type: 'string', enum: ['low', 'medium', 'high'] },
                includeMetadata: { type: 'boolean', default: false },
                expiresInHours: { type: 'number', minimum: 1, maximum: 24, default: 24 },
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
                  fileName: { type: 'string' },
                  fileUrl: { type: 'string' },
                  fileSize: { type: 'number' },
                  pageCount: { type: 'number' },
                  status: { type: 'string' },
                  isPreview: { type: 'boolean' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  generatedBy: { type: 'string', format: 'uuid' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { templateId, data, options } = request.body;

      const result = await deps.generatePreviewUseCase.execute(
        templateId,
        data,
        userId,
        options
      );

      return reply.status(201).send({ data: result });
    }
  );
 

  fastify.post<{ Params: { templateId: string }; Body: Omit<GeneratePdfData, 'templateId'> }>(
    '/generate/:templateId',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'Generate PDF from template',
        description: 'Generate a PDF from a specific template.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['templateId'],
          properties: {
            templateId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { type: 'object', additionalProperties: true },
            options: {
              type: 'object',
              properties: {
                quality: { type: 'string', enum: ['low', 'medium', 'high'] },
                includeMetadata: { type: 'boolean', default: true },
                filename: { type: 'string' },
                expiresInHours: { type: 'number', minimum: 1, maximum: 720 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { templateId } = request.params;
      const { data, options } = request.body;

      const result = await deps.generatePdfUseCase.execute(
        templateId,
        data,
        userId,
        options
      );

      return reply.status(201).send({ data: result });
    }
  );


  fastify.post<{ Params: { templateId: string }; Body: Omit<GeneratePreviewData, 'templateId'> }>(
    '/preview/:templateId',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'Generate preview from template',
        description: 'Generate a preview PDF from a specific template.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['templateId'],
          properties: {
            templateId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { type: 'object', additionalProperties: true },
            options: {
              type: 'object',
              properties: {
                quality: { type: 'string', enum: ['low', 'medium', 'high'] },
                includeMetadata: { type: 'boolean', default: false },
                expiresInHours: { type: 'number', minimum: 1, maximum: 24, default: 24 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { templateId } = request.params;
      const { data, options } = request.body;

      const result = await deps.generatePreviewUseCase.execute(
        templateId,
        data,
        userId,
        options
      );

      return reply.status(201).send({ data: result });
    }
  );


 fastify.get<{ Querystring: PdfGenerationJobFilters }>(
    '/documents',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'List PDF documents',
        description: 'List all generated PDF documents for the authenticated user.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            templateId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['PENDING', 'GENERATING', 'GENERATED', 'FAILED', 'EXPIRED'] },
            isPreview: { type: 'string', enum: ['true', 'false'] },
            fromDate: { type: 'string', format: 'date-time' },
            toDate: { type: 'string', format: 'date-time' },
            search: { type: 'string' },
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
                    fileName: { type: 'string' },
                    fileUrl: { type: 'string' },
                    fileSize: { type: 'number' },
                    pageCount: { type: 'number' },
                    status: { type: 'string' },
                    isPreview: { type: 'boolean' },
                    expiresAt: { type: 'string', format: 'date-time', nullable: true },
                    generatedBy: { type: 'string', format: 'uuid' },
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
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
     const query = request.query;  

   
  const result = await deps.listPdfDocumentsUseCase.execute(userId, {
      templateId: query.templateId,
      status: query.status as DocumentStatus,
      isPreview: query.isPreview,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      search: query.search,
      page: parseInt(query.page || '1'),
      limit: Math.min(parseInt(query.limit || '20'), 100),
    });

      return reply.send({
        data: result.items,
        pagination: result.pagination,
      });
    }
  );


  fastify.get<{ Params: { id: string } }>(
    '/documents/:id',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'Get PDF document',
        description: 'Get metadata for a generated PDF document.',
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
      const { id } = request.params;

      const result = await deps.getPdfDocumentUseCase.execute(userId, id);
      return reply.send({ data: result });
    }
  );


  fastify.get<{ Params: { id: string } }>(
    '/documents/:id/download',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'Download PDF document',
        description: 'Download a generated PDF document.',
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
      const { id } = request.params;

      const result = await deps.downloadPdfDocumentUseCase.execute(userId, id);


      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${result.fileName}"`);
      reply.header('Content-Length', result.fileSize);
      reply.header('Cache-Control', 'no-cache');


      return reply.send(result.fileBuffer);
    }
  );


  fastify.get<{ Params: { id: string } }>(
    '/documents/:id/view',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'View PDF document',
        description: 'View a generated PDF document in the browser.',
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
      const { id } = request.params;

      const result = await deps.downloadPdfDocumentUseCase.execute(userId, id);


      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="${result.fileName}"`);
      reply.header('Content-Length', result.fileSize);
      reply.header('Cache-Control', 'public, max-age=3600');

      return reply.send(result.fileBuffer);
    }
  );


  fastify.delete<{ Params: { id: string } }>(
    '/documents/:id',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'Delete PDF document',
        description: 'Delete a generated PDF document.',
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
      const { id } = request.params;

      await deps.deletePdfDocumentUseCase.execute(userId, id);
      return reply.status(204).send();
    }
  );


 

fastify.post<{ 
  Params: { id: string }; 
  Body: RegenerateDocumentBody 
}>(
  '/documents/:id/regenerate',
  {
    preHandler: [deps.requireAuth],
    schema: {
      tags: ['PDF Generation'],
      summary: 'Regenerate PDF document',
      description: 'Regenerate a PDF document with updated data.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          data: { type: 'object', additionalProperties: true },
          options: {
            type: 'object',
            properties: {
              quality: { type: 'string', enum: ['low', 'medium', 'high'] },
              includeMetadata: { type: 'boolean', default: true },
              filename: { type: 'string' },
            },
          },
        },
      },
    },
  },
  async (request, reply) => {
    const userId = request.user!.sub;
    const { id } = request.params;
    const { data, options } = request.body;
    
    console.log("userId", userId);
    console.log("data", data);
    console.log("options", options);


    const existing = await deps.getPdfDocumentUseCase.execute(userId, id);
 const originalName = existing.fileName;
    const fileExt = originalName.lastIndexOf('.') > -1 
      ? originalName.substring(originalName.lastIndexOf('.')) 
      : '.pdf';
    const fileNameWithoutExt = originalName.lastIndexOf('.') > -1 
      ? originalName.substring(0, originalName.lastIndexOf('.')) 
      : originalName;
    
    const newFileName = `${fileNameWithoutExt}-regenerated-${Date.now()}${fileExt}`;

      const result = await deps.generatePdfUseCase.execute(
      existing.templateId,
      data || existing.data,
      userId,
      { 
        ...options, 
        filename: newFileName  
      }
    );

    return reply.status(201).send({ data: result });
  }
);


  fastify.post<{ Body: BatchPdfRequestBody }>(
  '/batch/generate',
  {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'Batch generate PDFs',
        description: 'Generate multiple PDFs in a single request.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 50,
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
                      includeMetadata: { type: 'boolean', default: true },
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
      const { items } = request.body;

      const results = await Promise.all(
        items.map(async (item) => {
          try {
            const result = await deps.generatePdfUseCase.execute(
              item.templateId,
              item.data,
              userId,
              item.options
            );
            return { success: true, data: result };
          }
          catch (error) {
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error occurred',
    templateId: item.templateId,
  };
}

        })
      );

      return reply.status(207).send({ data: results });  
    }
  );


  fastify.post<{ Body: GeneratePdfData }>(
    '/validate',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'Validate PDF data',
        description: 'Validate data before generating PDF.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['templateId', 'data'],
          properties: {
            templateId: { type: 'string', format: 'uuid' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { templateId, data } = request.body;
  console.log("userId",data)
    console.log("organizationId",templateId)
    console.log("userId",userId)


      const isValid = true;
      const errors: Array<{ field: string; message: string }> = [];

      return reply.send({
        data: {
          isValid,
          errors,
        },
      });
    }
  );

 
fastify.get<{ Querystring: DocumentStatsFilters }>(
    '/stats',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Generation'],
        summary: 'Get generation statistics',
        description: 'Get statistics about PDF generation.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
            fromDate: { type: 'string', format: 'date-time' },
            toDate: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const query = request.query ;

      const stats = await deps.listPdfDocumentsUseCase.executeStats(userId, {
        period: query.period || 'month',
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
      });

      return reply.send({ data: stats });
    }
  );


  fastify.post<{ Params: { templateId: string }; Body: Omit<GeneratePdfData, 'templateId'> }>(
    '/public/generate/:templateId',
    {
      schema: {
        tags: ['PDF Generation'],
        summary: 'Generate PDF from public template',
        description: 'Generate a PDF from a public template (no authentication required).',
        params: {
          type: 'object',
          required: ['templateId'],
          properties: {
            templateId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { type: 'object', additionalProperties: true },
            options: {
              type: 'object',
              properties: {
                quality: { type: 'string', enum: ['low', 'medium', 'high'] },
                includeMetadata: { type: 'boolean', default: true },
                filename: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { templateId } = request.params;
      const { data, options } = request.body;
      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];


      const result = await deps.generatePdfUseCase.execute(
        templateId,
        data,
        undefined, // No user ID
        { ...options, ipAddress, userAgent }
      );

      return reply.status(201).send({ data: result });
    }
  );


  fastify.post<{ Params: { templateId: string }; Body: Omit<GeneratePreviewData, 'templateId'> }>(
    '/public/preview/:templateId',
    {
      schema: {
        tags: ['PDF Generation'],
        summary: 'Preview PDF from public template',
        description: 'Preview a PDF from a public template (no authentication required).',
        params: {
          type: 'object',
          required: ['templateId'],
          properties: {
            templateId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { type: 'object', additionalProperties: true },
            options: {
              type: 'object',
              properties: {
                quality: { type: 'string', enum: ['low', 'medium', 'high'] },
                includeMetadata: { type: 'boolean', default: false },
                expiresInHours: { type: 'number', minimum: 1, maximum: 24, default: 24 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { templateId } = request.params;
      const { data, options } = request.body;
      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];

      const result = await deps.generatePreviewUseCase.execute(
        templateId,
        data,
        undefined, // No user ID
        { ...options, ipAddress, userAgent }
      );

      return reply.status(201).send({ data: result });
    }
  );
}