import { GeneratePdfData, GeneratePreviewData } from "@application/dto/generate-pdf.dto.js";
import { ValidationData, ValidationResult } from "@application/interfaces/validation.js";
import { DownloadPdfDocumentUseCase } from "@application/use-cases/pdf-generation/download-pdf-document.usecase.js";
import { GeneratePdfUseCase } from "@application/use-cases/pdf-generation/generate-pdf.usecase.js";
import { GeneratePreviewUseCase } from "@application/use-cases/pdf-generation/generate-preview.usecase.js";
import { GetPdfDocumentUseCase } from "@application/use-cases/pdf-generation/get-pdf-document.usecase.js";
import { GetPdfTemplateUseCase } from "@application/use-cases/pdf-templates/get-pdf-template.usecase.js";
import { isValidEmail } from "@shared/utils/common.js";
import { FastifyInstance } from "fastify";

 
interface PublicPdfDependencies {
  getPdfTemplateUseCase: GetPdfTemplateUseCase;
  generatePdfUseCase: GeneratePdfUseCase;
  generatePreviewUseCase: GeneratePreviewUseCase;
  getPdfDocumentUseCase: GetPdfDocumentUseCase;
  downloadPdfDocumentUseCase: DownloadPdfDocumentUseCase;
}

export async function publicPdfRoutes(
  fastify: FastifyInstance,
  deps: PublicPdfDependencies
) {

  fastify.get<{ Params: { id: string } }>(
    '/public/templates/:id',
    {
      schema: {
        tags: ['Public PDF'],
        summary: 'Get public PDF template',
        description: 'Get a public PDF template (no authentication required).',
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
                  name: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  category: { type: 'string', nullable: true },
                  tags: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  pageSize: { type: 'string' },
                  orientation: { type: 'string' },
                  backgroundType: { type: 'string' },
                  backgroundUrl: { type: 'string', nullable: true },
                  version: { type: 'string' },
                  isActive: { type: 'boolean' },
                  isPublic: { type: 'boolean' },
                  thumbnailUrl: { type: 'string', nullable: true },
                  estimatedPages: { type: 'number', nullable: true },
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
      const { id } = request.params;

      try {
        const template = await deps.getPdfTemplateUseCase.executePublic(id);
        return reply.send({ data: template });
      } 
      catch (error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'NOT_FOUND'
  ) {
    return reply.status(404).send({
      error: 'Template not found',
      message: 'The requested PDF template does not exist or is not public.',
    });
  }
  throw error;
}

    }
  );


  fastify.get<{ Params: { id: string } }>(
    '/public/templates/:id/info',
    {
      schema: {
        tags: ['Public PDF'],
        summary: 'Get public template info',
        description: 'Get basic info about a public PDF template (lightweight).',
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

      try {
        const template = await deps.getPdfTemplateUseCase.executePublic(id);
        

        const templateInfo = {
          id: template.id,
          name: template.name,
          title: template.title,
          description: template.description,
          category: template.category,
          pageSize: template.pageSize,
          orientation: template.orientation,
          estimatedPages: template.estimatedPages,
          thumbnailUrl: template.thumbnailUrl,
        };

        return reply.send({ data: templateInfo });
      }
      catch (error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'NOT_FOUND'
  ) {
    return reply.status(404).send({
      error: 'Template not found',
      message: 'The requested PDF template does not exist or is not public.',
    });
  }
  throw error;
}

    }
  );


  fastify.post<{ 
    Params: { id: string }; 
    Body: Omit<GeneratePdfData, 'templateId'> 
  }>(
    '/public/generate_template/:id',
    {
      schema: {
        tags: ['Public PDF'],
        summary: 'Generate PDF from public template',
        description: 'Generate a PDF from a public template (no authentication required).',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['data'],
          properties: {
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
                expiresInHours: {
                  type: 'number',
                  minimum: 1,
                  maximum: 720,
                  default: 24,
                  description: 'Hours before document expires (for previews)'
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
                  fileName: { type: 'string' },
                  fileUrl: { type: 'string' },
                  downloadUrl: { type: 'string' },
                  fileSize: { type: 'number' },
                  pageCount: { type: 'number' },
                  status: { type: 'string' },
                  isPreview: { type: 'boolean' },
                  expiresAt: { type: 'string', format: 'date-time', nullable: true },
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
              validationErrors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id: templateId } = request.params;
      const { data, options } = request.body;
      

      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];

      try {
        const result = await deps.generatePdfUseCase.execute(
          templateId,
          data,
          undefined, // No user ID for public generation
          {
            ...options,
            ipAddress,
            userAgent,
          }
        );


        const response = {
          ...result,
          downloadUrl: `/api/v1/pdf/public/documents/${result.id}/download`,
        };

        return reply.status(201).send({ data: response });
      } 
      catch (error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: string; details?: unknown };

    if (err.code === 'NOT_FOUND') {
      return reply.status(404).send({
        error: 'Template not found',
        message: 'The requested PDF template does not exist or is not public.',
      });
    }

    if (err.code === 'VALIDATION_ERROR') {
      return reply.status(400).send({
        error: 'Validation failed',
        message: 'Invalid data provided for template.',
        validationErrors: err.details,
      });
    }

    if (err.code === 'ACCESS_DENIED') {
      return reply.status(403).send({
        error: 'Access denied',
        message: 'You do not have access to this template.',
      });
    }
  }

  throw error;
}

    }
  );


  fastify.post<{ 
    Params: { id: string }; 
    Body: Omit<GeneratePreviewData, 'templateId'> 
  }>(
    '/public/preview_pdf/:id',
    {
      schema: {
        tags: ['Public PDF'],
        summary: 'Preview PDF from public template',
        description: 'Generate a preview PDF from a public template (expires after 24 hours).',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { 
              type: 'object', 
              additionalProperties: true 
            },
            options: {
              type: 'object',
              properties: {
                quality: { 
                  type: 'string', 
                  enum: ['low', 'medium', 'high'], 
                  default: 'low' 
                },
                includeMetadata: { 
                  type: 'boolean', 
                  default: false 
                },
                expiresInHours: { 
                  type: 'number', 
                  minimum: 1, 
                  maximum: 24, 
                  default: 24 
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id: templateId } = request.params;
      const { data, options } = request.body;
      

      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];

      try {
        const result = await deps.generatePreviewUseCase.execute(
          templateId,
          data,
          undefined,  
          {
            ...options,
            ipAddress,
            userAgent,
          }
        );


        const response = {
          ...result,
          downloadUrl: `/api/v1/pdf/public/documents/${result.id}/download`,
          expiresAt: result.expiresAt?.toISOString(),
        };

        return reply.status(201).send({ data: response });
      } 
      catch (error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: string; details?: unknown };

    if (err.code === 'NOT_FOUND') {
      return reply.status(404).send({
        error: 'Template not found',
        message: 'The requested PDF template does not exist or is not public.',
      });
    }

    if (err.code === 'VALIDATION_ERROR') {
      return reply.status(400).send({
        error: 'Validation failed',
        message: 'Invalid data provided for template.',
        validationErrors: err.details,
      });
    }

    if (err.code === 'ACCESS_DENIED') {
      return reply.status(403).send({
        error: 'Access denied',
        message: 'You do not have access to this template.',
      });
    }
  }
 
  throw error;
}

    }
  );


  fastify.get<{ Params: { id: string } }>(
    '/public/documents/:id',
    {
      schema: {
        tags: ['Public PDF'],
        summary: 'Get public PDF document',
        description: 'Get metadata for a publicly generated PDF document.',
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

      try {
        const result = await deps.getPdfDocumentUseCase.executePublic(id);
        return reply.send({ data: result });
      } 
    catch (error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: string };

    if (err.code === 'NOT_FOUND') {
      return reply.status(404).send({
        error: 'Document not found',
        message: 'The requested PDF document does not exist or is no longer available.',
      });
    }

    if (err.code === 'EXPIRED') {
      return reply.status(410).send({
        error: 'Document expired',
        message: 'This preview document has expired.',
      });
    }
  }

  
  throw error;
}

    }
  );


  fastify.get<{ Params: { id: string } }>(
    '/public/documents/:id/download',
    {
      schema: {
        tags: ['Public PDF'],
        summary: 'Download public PDF document',
        description: 'Download a publicly generated PDF document.',
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
      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];
        console.log("ipAddress",ipAddress)
            console.log("userAgent",userAgent)
      try {
        const result = await deps.downloadPdfDocumentUseCase.executePublic(id);


        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="${result.fileName}"`);
        reply.header('Content-Length', result.fileSize);
        reply.header('Cache-Control', 'public, max-age=3600');

        return reply.send(result.fileBuffer);
      } 
      catch (error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const err = error as { code?: string };

    if (err.code === 'NOT_FOUND') {
      return reply.status(404).send({
        error: 'Document not found',
        message: 'The requested PDF document does not exist or is no longer available.',
      });
    }

    if (err.code === 'EXPIRED') {
      return reply.status(410).send({
        error: 'Document expired',
        message: 'This preview document has expired.',
      });
    }
  }

  throw error;
}

    }
  );


  fastify.get<{ Params: { id: string } }>(
    '/public/documents/:id/view',
    {
      schema: {
        tags: ['Public PDF'],
        summary: 'View public PDF document',
        description: 'View a publicly generated PDF document in the browser.',
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

      try {
        const result = await deps.downloadPdfDocumentUseCase.executePublic(id);


        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `inline; filename="${result.fileName}"`);
        reply.header('Content-Length', result.fileSize);
        reply.header('Cache-Control', 'public, max-age=3600');

        return reply.send(result.fileBuffer);
      }
       catch (error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const typedError = error as { code?: string };

    if (typedError.code === 'NOT_FOUND') {
      return reply.status(404).send({
        error: 'Document not found',
        message: 'The requested PDF document does not exist or is no longer available.',
      });
    }

    if (typedError.code === 'EXPIRED') {
      return reply.status(410).send({
        error: 'Document expired',
        message: 'This preview document has expired.',
      });
    }
  }

  throw error;
}

    }
  );


 
 

 
fastify.post<{ 
  Params: { id: string }; 
  Body: { data: ValidationData } 
}>(
  '/public/validate/:id',
  {
    schema: {
      tags: ['Public PDF'],
      summary: 'Validate data for public template',
      description: 'Validate data before generating PDF from a public template.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['data'],
        properties: {
          data: { 
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  },
  async (request, reply) => {
    const { id: templateId } = request.params;
    const { data } = request.body;

    try {
      // Get the template
      const template = await deps.getPdfTemplateUseCase.executePublic(templateId);

      // Initialize validation result
      const validationResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      // Validate if template has validation rules
      if (template.validationRules) {
        const rules = template.validationRules;
        
        // Validate required fields
        if (rules.requiredFields) {
          for (const field of rules.requiredFields) {
            const value = data[field];
            if (
              value === undefined || 
              value === null || 
              (typeof value === 'string' && value.trim() === '')
            ) {
              validationResult.isValid = false;
              validationResult.errors.push({
                field,
                message: 'This field is required',
              });
            }
          }
        }

        // Validate field validators
        if (rules.fieldValidators) {
          for (const [field, validator] of Object.entries(rules.fieldValidators)) {
            const value = data[field];
            if (value !== undefined && value !== null) {
              // Validate based on validator type
              switch (validator.type) {
                case 'email':
                  if (typeof value === 'string' && !isValidEmail(value)) {
                    validationResult.isValid = false;
                    validationResult.errors.push({
                      field,
                      message: validator.errorMessage || 'Invalid email format',
                    });
                  }
                  break;
                  
                case 'regex':
                  if (typeof value === 'string' && validator.pattern && !new RegExp(validator.pattern).test(value)) {
                    validationResult.isValid = false;
                    validationResult.errors.push({
                      field,
                      message: validator.errorMessage || 'Invalid format',
                    });
                  }
                  break;
                  
                case 'range':
                  if (typeof value === 'number') {
                    if (validator.min !== undefined && value < validator.min) {
                      validationResult.isValid = false;
                      validationResult.errors.push({
                        field,
                        message: validator.errorMessage || `Value must be at least ${validator.min}`,
                      });
                    }
                    if (validator.max !== undefined && value > validator.max) {
                      validationResult.isValid = false;
                      validationResult.errors.push({
                        field,
                        message: validator.errorMessage || `Value must be at most ${validator.max}`,
                      });
                    }
                  }
                  break;
                  
                case 'enum':
                  if (validator.enum && !validator.enum.includes(String(value))) {
                    validationResult.isValid = false;
                    validationResult.errors.push({
                      field,
                      message: validator.errorMessage || `Value must be one of: ${validator.enum.join(', ')}`,
                    });
                  }
                  break;
              }
            }
          }
        }

        // Validate cross-field validators
        if (rules.crossFieldValidators) {
          for (const validator of rules.crossFieldValidators) {
            // You can implement cross-field validation logic here
            const fieldValues = validator.fields.map(field => data[field]);
            
            // Example: Check if all fields have values
            const allFieldsPresent = fieldValues.every(value => 
              value !== undefined && value !== null && 
              (typeof value !== 'string' || value.trim() !== '')
            );
            
            if (!allFieldsPresent && validator.condition === 'allRequired') {
              validationResult.isValid = false;
              validationResult.errors.push({
                field: validator.fields.join(', '),
                message: validator.errorMessage || 'All related fields are required',
              });
            }
          }
        }
      }

      return reply.send({
        data: validationResult,
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error) {
        const typedError = error as { code?: string };

        if (typedError.code === 'NOT_FOUND') {
          return reply.status(404).send({
            error: 'Template not found',
            message: 'The requested PDF template does not exist or is not public.',
          });
        }
      }

      throw error;
    }
  }
);
 


  fastify.get(
    '/public/health',
    {
      schema: {
        tags: ['Public PDF'],
        summary: 'Public health check',
        description: 'Check if the public PDF service is running.',
      },
    },
    async () => {
      return {
        status: 'ok',
        service: 'pdf-service-public',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };
    }
  );

  
}

 