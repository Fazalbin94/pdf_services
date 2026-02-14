
import type { FastifyInstance } from 'fastify';
import type { PreHandler } from '../types.js';
 
import type {
  CreatePdfTemplateData,
  UpdatePdfTemplateData,
  ClonePdfTemplateData,
  ListPdfTemplatesFilters,
} from '../../application/dto/pdf-template.dto.js';
import { CreatePdfTemplateUseCase } from '@application/use-cases/pdf-templates/create-pdf-template.usecase.js';
import { DeletePdfTemplateUseCase } from '@application/use-cases/pdf-templates/delete-pdf-template.usecase.js';
import { GetPdfTemplateUseCase } from '@application/use-cases/pdf-templates/get-pdf-template.usecase.js';
import { ListPdfTemplatesUseCase } from '@application/use-cases/pdf-templates/list-pdf-templates.usecase.js';
import { UpdatePdfTemplateUseCase } from '@application/use-cases/pdf-templates/update-pdf-template.usecase.js';
import { ClonePdfTemplateUseCase } from '@application/use-cases/pdf-templates/clone-pdf-template.usecase.js';
import { RestorePdfTemplateUseCase } from '@application/use-cases/pdf-templates/restore-pdf-template.usecase.js';

interface PdfTemplateDependencies {
  createPdfTemplateUseCase: CreatePdfTemplateUseCase;
  getPdfTemplateUseCase: GetPdfTemplateUseCase;
  listPdfTemplatesUseCase: ListPdfTemplatesUseCase;
  updatePdfTemplateUseCase: UpdatePdfTemplateUseCase;
  deletePdfTemplateUseCase: DeletePdfTemplateUseCase;
  clonePdfTemplateUseCase: ClonePdfTemplateUseCase;
  restorePdfTemplateUseCase:RestorePdfTemplateUseCase
  requireAuth: PreHandler;
}

export async function pdfTemplateRoutes(
  fastify: FastifyInstance,
  deps: PdfTemplateDependencies
) {

  fastify.get(
    '/',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Templates'],
        summary: 'List PDF templates',
        description: 'List all PDF templates for the authenticated user.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Filter by category' },
            isActive: { type: 'string', enum: ['true', 'false'], description: 'Filter by active status' },
            isPublic: { type: 'string', enum: ['true', 'false'], description: 'Filter by public status' },
            search: { type: 'string', description: 'Search in name and title' },
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
                    name: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    isActive: { type: 'boolean' },
                    isPublic: { type: 'boolean' },
                    version: { type: 'string' },
                    pageSize: { type: 'string' },
                    orientation: { type: 'string' },
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
      const organizationId = request.user!.orgId;
     
     const query = request.query as {
      category?: string;
      isActive?: 'true' | 'false';
      isPublic?: 'true' | 'false';
      search?: string;
      page?: string;
      limit?: string;
    };

  
    const result = await deps.listPdfTemplatesUseCase.execute(userId, {
      category: query.category,
      isActive: query.isActive,  
      isPublic: query.isPublic,  
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? Math.min(parseInt(query.limit, 10), 100) : 20,
    }, organizationId);

      return reply.send({
        data: result.items,
        pagination: result.pagination,
      });
    }
  );


  fastify.get<{ Params: { id: string } }>(
    '/public/:id',
    {
      schema: {
        tags: ['PDF Templates'],
        summary: 'Get public PDF template',
        description: 'Get a public PDF template (no authentication required).',
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
      const { id } = request.params;
      const result = await deps.getPdfTemplateUseCase.executePublic(id);
      return reply.send({ data: result });
    }
  );


  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Templates'],
        summary: 'Get PDF template',
        description: 'Get a PDF template by ID.',
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

      const result = await deps.getPdfTemplateUseCase.execute(userId, id, organizationId);
      return reply.send({ data: result });
    }
  );


  fastify.post<{ Body: CreatePdfTemplateData }>(
    '/',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Templates'],
        summary: 'Create PDF template',
        description: 'Create a new PDF template.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'title', 'config'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            title: { type: 'string', minLength: 1, maxLength: 200 },
            description: { type: 'string', maxLength: 1000 },
            category: { type: 'string', maxLength: 50 },
            tags: {
              type: 'array',
              items: { type: 'string', maxLength: 30 },
              maxItems: 10,
            },
            config: { type: 'object' },
            variables: { type: 'object' },
            validationRules: { type: 'object' },
            defaultData: { type: 'object' },
            pageSize: { type: 'string', enum: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'LETTER', 'LEGAL', 'TABLOID', 'CUSTOM'] },
            orientation: { type: 'string', enum: ['PORTRAIT', 'LANDSCAPE'] },
            margins: {
              type: 'object',
              properties: {
                top: { type: 'number', minimum: 0 },
                right: { type: 'number', minimum: 0 },
                bottom: { type: 'number', minimum: 0 },
                left: { type: 'number', minimum: 0 },
              },
            },
            fonts: { type: 'object' },
            styles: { type: 'object' },
            backgroundType: { type: 'string', enum: ['NONE', 'COLOR', 'IMAGE', 'PDF', 'LETTERHEAD'] },
            backgroundUrl: { type: 'string', format: 'uri' },
            backgroundColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            opacity: { type: 'number', minimum: 0, maximum: 1 },
            headerContent: { type: 'object' },
            footerContent: { type: 'object' },
            isActive: { type: 'boolean', default: true },
            isPublic: { type: 'boolean', default: false },
            organizationId: { type: 'string', format: 'uuid', nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const data = request.body as CreatePdfTemplateData;

      const result = await deps.createPdfTemplateUseCase.execute(userId, data);
      return reply.status(201).send({ data: result });
    }
  );


  fastify.put<{ Params: { id: string }; Body: UpdatePdfTemplateData }>(
    '/:id',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Templates'],
        summary: 'Update PDF template',
        description: 'Update an existing PDF template.',
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
            name: { type: 'string', minLength: 1, maxLength: 100 },
            title: { type: 'string', minLength: 1, maxLength: 200 },
            description: { type: 'string', maxLength: 1000, nullable: true },
            category: { type: 'string', maxLength: 50, nullable: true },
            tags: {
              type: 'array',
              items: { type: 'string', maxLength: 30 },
              maxItems: 10,
              nullable: true,
            },
            config: { type: 'object' },
            variables: { type: 'object', nullable: true },
            validationRules: { type: 'object', nullable: true },
            defaultData: { type: 'object', nullable: true },
            pageSize: { type: 'string', enum: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'LETTER', 'LEGAL', 'TABLOID', 'CUSTOM'] },
            orientation: { type: 'string', enum: ['PORTRAIT', 'LANDSCAPE'] },
            margins: {
              type: 'object',
              nullable: true,
              properties: {
                top: { type: 'number', minimum: 0 },
                right: { type: 'number', minimum: 0 },
                bottom: { type: 'number', minimum: 0 },
                left: { type: 'number', minimum: 0 },
              },
            },
            fonts: { type: 'object', nullable: true },
            styles: { type: 'object', nullable: true },
            backgroundType: { type: 'string', enum: ['NONE', 'COLOR', 'IMAGE', 'PDF', 'LETTERHEAD'] },
            backgroundUrl: { type: 'string', format: 'uri', nullable: true },
            backgroundColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', nullable: true },
            opacity: { type: 'number', minimum: 0, maximum: 1, nullable: true },
            headerContent: { type: 'object', nullable: true },
            footerContent: { type: 'object', nullable: true },
            isActive: { type: 'boolean' },
            isPublic: { type: 'boolean' },
            organizationId: { type: 'string', format: 'uuid', nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const { id } = request.params;
      const data = request.body as UpdatePdfTemplateData;

      const result = await deps.updatePdfTemplateUseCase.execute(userId, id, data, organizationId);
      return reply.send({ data: result });
    }
  );


  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Templates'],
        summary: 'Delete PDF template',
        description: 'Soft delete a PDF template (can be restored).',
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

      await deps.deletePdfTemplateUseCase.execute(userId, id, organizationId);
      return reply.status(204).send();
    }
  );


  fastify.post<{ Params: { id: string }; Body: ClonePdfTemplateData }>(
    '/:id/clone',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Templates'],
        summary: 'Clone PDF template',
        description: 'Clone an existing PDF template with a new name.',
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
          required: ['newName'],
          properties: {
            newName: { type: 'string', minLength: 1, maxLength: 100 },
            newTitle: { type: 'string', minLength: 1, maxLength: 200 },
            description: { type: 'string', maxLength: 1000, nullable: true },
            isActive: { type: 'boolean', default: true },
            isPublic: { type: 'boolean', default: false },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const { id } = request.params;
      const data = request.body as ClonePdfTemplateData;
 console.log('Route handler data:', data);
      const result = await deps.clonePdfTemplateUseCase.execute(userId, id, data, organizationId);
      return reply.status(201).send({ data: result });
    }
  );

  // GET /:id/stats - Get PDF template statistics (authenticated)
  // fastify.get<{ Params: { id: string } }>(
  //   '/:id/stats',
  //   {
  //     preHandler: [deps.requireAuth],
  //     schema: {
  //       tags: ['PDF Templates'],
  //       summary: 'Get PDF template statistics',
  //       description: 'Get usage statistics for a PDF template.',
  //       security: [{ bearerAuth: [] }],
  //       params: {
  //         type: 'object',
  //         required: ['id'],
  //         properties: {
  //           id: { type: 'string', format: 'uuid' },
  //         },
  //       },
  //     },
  //   },
  //   async (request, reply) => {
  //     const userId = request.user!.sub;
  //     const organizationId = request.user!.orgId;
  //     const { id } = request.params;

  //     const result = await deps.getPdfTemplateStatsUseCase.execute(userId, id, organizationId);
  //     return reply.send({ data: result });
  //   }
  // );

  // POST /:id/restore - Restore deleted PDF template (authenticated)
// Update the restore route
fastify.post(
  '/:id/restore',
  {
    preHandler: [deps.requireAuth],
  },
  async (request, reply) => {
    try {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
     const id = (request.params as { id: string }).id;


      const result = await  deps.restorePdfTemplateUseCase.execute(
        userId,
        id,
        organizationId
      );

      return reply.send({ data: result });
    } catch (err) {
      request.log.error(err, 'Restore PDF template failed');
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Unexpected error',
        },
      });
    }
  }
);




  fastify.post<{ Params: { id: string } }>(
    '/:id/publish',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Templates'],
        summary: 'Publish PDF template',
        description: 'Make a PDF template publicly accessible.',
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

      const result = await deps.updatePdfTemplateUseCase.execute(userId, id, {
        isPublic: true,
        publishedAt: new Date(),
      }, organizationId);

      return reply.send({ data: result });
    }
  );


  fastify.post<{ Params: { id: string } }>(
    '/:id/unpublish',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Templates'],
        summary: 'Unpublish PDF template',
        description: 'Make a PDF template private.',
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

      const result = await deps.updatePdfTemplateUseCase.execute(userId, id, {
        isPublic: false,
        publishedAt: null,
      }, organizationId);

      return reply.send({ data: result });
    }
  );


  fastify.get(
    '/categories',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['PDF Templates'],
        summary: 'List template categories',
        description: 'List all unique categories used in PDF templates.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;


      const categories = await deps.listPdfTemplatesUseCase.executeCategories(userId, organizationId);
      return reply.send({ data: categories });
    }
  );
}