 
import type { FastifyInstance } from 'fastify';
import type { PreHandler } from '../types.js';
 
import type {
  CreateLetterheadData,
  CreateLetterheadInput,
  LetterheadFile,
  UpdateLetterheadData,
} from '../../application/dto/letterhead.dto.js';
import { DeleteLetterheadUseCase } from '@application/use-cases/letterheads/delete-letterhead.usecase.js';
import { UpdateLetterheadUseCase } from '@application/use-cases/letterheads/update-letterhead.usecase.js';
import { GetLetterheadUseCase } from '@application/use-cases/letterheads/get-letterhead.usecase.js';
import { ListLetterheadsUseCase } from '@application/use-cases/letterheads/list-letterheads.usecase.js';
import { CreateLetterheadUseCase } from '@application/use-cases/letterheads/create-letterhead.usecase.js';
import { MultipartFile } from '@fastify/multipart';
import { LetterheadAccessDeniedError, LetterheadDuplicateError, LetterheadError, LetterheadNotFoundError, LetterheadValidationError } from '@domain/errors/letterhead-error.js';
import { multipartSchema } from '@infrastructure/http/schemas/multipart-schema.js';
import { CloneLetterheadUseCase } from '@application/use-cases/letterheads/clone-letterhead.usecase.js';
import { getStatusCodeForError } from '@presentation/error-handler.js';
import { ListLetterheadsQuery } from '@infrastructure/database/types/DatabaseQueryFilter.js';
import { BUCKET_NAME, detectMimeType } from '@shared/letterhead/lettherhead.js';
import { IStorageService } from '@application/interfaces/storage-service.js';
import { LetterheadBase64Response, LetterheadBaseData, LetterheadSignedUrlResponse } from '@presentation/http/letterheads/types/letterhead.response.js';
import { StorageError } from '@domain/errors/index.js';
import { UpdateLetterheadFileUseCase } from '@application/use-cases/letterheads/update-letterhead-fileusecase.js';
import { PatchLetterheadUseCase } from '@application/use-cases/letterheads/patch-letterhead.usecase.js';
import { parseBoolean, parseNumber } from '@shared/utils/common.js';
import { GetLetterheadFileDataUseCase } from '@application/use-cases/letterheads/get-letterhead-file-data.usecase.js';
import { FileDataResponse } from '@presentation/http/letterheads/types/update-letterhead-file.dto.js';
import { SupabaseClient } from '@supabase/supabase-js';

interface LetterheadDependencies {
  uploadLetterheadUseCase:  CreateLetterheadUseCase;
  listLetterheadsUseCase: ListLetterheadsUseCase;
  getLetterheadUseCase: GetLetterheadUseCase;
  updateLetterheadUseCase: UpdateLetterheadUseCase;
  deleteLetterheadUseCase: DeleteLetterheadUseCase;
  cloneLetterheadUseCase:CloneLetterheadUseCase;
  updateLetterheadFileUseCase:UpdateLetterheadFileUseCase;
  patchLetterheadUseCase:PatchLetterheadUseCase;
  getLetterheadFileDataUseCase:GetLetterheadFileDataUseCase
   storageService: IStorageService,
  
  requireAuth: PreHandler;
  requireSuperAdmin: PreHandler;

}

export async function letterheadRoutes(
  fastify: FastifyInstance,
  deps: LetterheadDependencies
) {

  fastify.get<{
    Querystring: {
      category?: string;
      isActive?: string;
      isPublic?: string;
      fileType?: string;
      search?: string;
      page?: string;
      limit?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      securityOption?: 'base64' | 'signed-url' | 'none';
      expiresIn?: number;
    }
  }>(
    '/',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['Letterheads'],
        summary: 'List letterheads',
        description: 'List all letterheads for the authenticated user or organization.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Filter by category' },
            isActive: { type: 'string', enum: ['true', 'false'], description: 'Filter by active status' },
            isPublic: { type: 'string', enum: ['true', 'false'], description: 'Filter by public status' },
            fileType: { type: 'string', enum: ['IMAGE', 'PDF', 'SVG'], description: 'Filter by file type' },
            search: { type: 'string', description: 'Search in name and description' },
            page: { type: 'string', default: '1', description: 'Page number' },
            limit: { type: 'string', default: '20', description: 'Items per page (max 100)' },
            sortBy: { type: 'string', default: 'createdAt', description: 'Sort field' },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc', description: 'Sort order' },
            securityOption: { 
              type: 'string', 
              enum: ['base64', 'signed-url', 'none'],
              default: 'none' 
            },
            expiresIn: { 
              type: 'number', 
              default: 3600,
              description: 'Expiration in seconds for signed URLs (if chosen)' 
            },
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
                    userId: { type: 'string', format: 'uuid' },
                    organizationId: { type: ['string', 'null'], format: 'uuid' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    paperSize: { type: 'string', enum: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'LETTER', 'LEGAL', 'TABLOID', 'CUSTOM'] },
                    orientation: { type: 'string', enum: ['PORTRAIT', 'LANDSCAPE'] },
                    margins: { 
                      type: 'object',
                      properties: {
                        top: { type: 'number' },
                        right: { type: 'number' },
                        bottom: { type: 'number' },
                        left: { type: 'number' }
                      }
                    },
                    safeZones: {
                      type: 'object',
                      properties: {
                        header: {
                          type: 'object',
                          properties: {
                            top: { type: 'number' },
                            bottom: { type: 'number' },
                            left: { type: 'number' },
                            right: { type: 'number' }
                          }
                        },
                        footer: {
                          type: 'object',
                          properties: {
                            top: { type: 'number' },
                            bottom: { type: 'number' },
                            left: { type: 'number' },
                            right: { type: 'number' }
                          }
                        }
                      }
                    },
                    brandColors: { type: 'array', items: { type: 'string' } },
                    primaryFont: { type: 'string' },
                    secondaryFont: { type: 'string' },
                    fileSize: { type: 'number' },
                    fileType: { type: 'string', enum: ['IMAGE', 'PDF', 'SVG'] },
                    mimeType: { type: 'string' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                    dpi: { type: 'number' },
                    dimensionsUnit: { type: 'string', enum: ['PIXELS', 'POINTS', 'MILLIMETERS', 'INCHES'] },
                    backgroundColor: { type: 'string' },
                    opacity: { type: 'number' },
                    marginSafeZone: {
                      type: 'object',
                      properties: {
                        top: { type: 'number' },
                        right: { type: 'number' },
                        bottom: { type: 'number' },
                        left: { type: 'number' }
                      }
                    },
                    colorProfile: { type: 'string', enum: ['RGB', 'CMYK', 'GRAYSCALE'] },
                    hasBleedArea: { type: 'boolean' },
                    bleedAreaSize: { type: 'number' },
                    isActive: { type: 'boolean' },
                    isPublic: { type: 'boolean' },
                    isSystem: { type: 'boolean' },
                    usageCount: { type: 'number' },
                    lastUsedAt: { type: 'string', format: 'date-time' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    publishedAt: { type: 'string', format: 'date-time' },
                    deletedAt: { type: 'string', format: 'date-time' },
                    version: { type: 'string' },
                    parentId: { type: 'string', format: 'uuid' },
                    // Conditional fields based on securityOption
                    fileBase64: { type: 'string' },
                    thumbnailBase64: { type: 'string' },
                    fileSignedUrl: { type: 'string' },
                    thumbnailSignedUrl: { type: 'string' },
                    signedUrlExpiresAt: { type: 'string', format: 'date-time' },
                  },
                  additionalProperties: true,
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                  hasNext: { type: 'boolean' },
                  hasPrevious: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.sub;
        const organizationId = request.user!.orgId;
        
        const {
          category,
          isActive,
          isPublic,
          fileType,
          search,
          page,
          limit,
          sortBy,
          sortOrder,
          securityOption = 'none',
          expiresIn = 3600
        } = request.query;
  
        // Call use case with security options
        const result = await deps.listLetterheadsUseCase.execute(
          userId,
          {
            category,
            isActive,
            isPublic,
            fileType,
            search,
            page: page ? parseInt(page) : 1,
            limit: Math.min(limit ? parseInt(limit) : 20, 100),
            sortBy,
            sortOrder,
            securityOption,
            expiresIn,
          },
          organizationId
        );
  
        // Transform items based on security option
        const transformedItems = await Promise.all(
          result.items.map(async (item) => {
            // Base letterhead data (always included)
            const baseData = {
              id: item.id,
              userId: item.userId,
              organizationId: item.organizationId,
              name: item.name,
              description: item.description,
              category: item.category,
              paperSize: item.paperSize,
              orientation: item.orientation,
              margins: item.margins,
              safeZones: item.safeZones,
              brandColors: item.brandColors,
              primaryFont: item.primaryFont,
              secondaryFont: item.secondaryFont,
              fileSize: item.fileSize,
              fileType: item.fileType,
              mimeType: item.mimeType,
              width: item.width,
              height: item.height,
              dpi: item.dpi,
              dimensionsUnit: item.dimensionsUnit,
              backgroundColor: item.backgroundColor,
              opacity: item.opacity,
              marginSafeZone: item.marginSafeZone,
              colorProfile: item.colorProfile,
              hasBleedArea: item.hasBleedArea,
              bleedAreaSize: item.bleedAreaSize,
              isActive: item.isActive,
              isPublic: item.isPublic,
              isSystem: item.isSystem,
              usageCount: item.usageCount,
              lastUsedAt: item.lastUsedAt,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
              publishedAt: item.publishedAt,
              deletedAt: item.deletedAt,
              version: item.version,
              parentId: item.parentId,
            };
  
            // Add file data based on security option
            let fileData = {};
            
            if (securityOption === 'base64' && item.filePath) {
              try {
                // Get file as base64
                const fileBuffer = await deps.storageService.downloadFile(item.filePath);
                const fileBase64 = fileBuffer.toString('base64');
                
                let thumbnailBase64: string | undefined;
                if (item.thumbnailPath) {
                  try {
                    const thumbBuffer = await deps.storageService.downloadFile(item.thumbnailPath);
                    thumbnailBase64 = thumbBuffer.toString('base64');
                  } catch (thumbError) {
                    console.warn(`Failed to get thumbnail for letterhead ${item.id}:`, thumbError);
                  }
                }
                
                fileData = {
                  fileBase64: `data:${item.mimeType};base64,${fileBase64}`,
                  ...(thumbnailBase64 && { 
                    thumbnailBase64: `data:image/jpeg;base64,${thumbnailBase64}` 
                  }),
                };
              } catch (fileError) {
                console.error(`Failed to get base64 for letterhead ${item.id}:`, fileError);
                // Don't add file data if it fails
              }
            }
            
            if (securityOption === 'signed-url' && item.filePath) {
              try {
                // Generate signed URL
                const fileSignedUrl = await deps.storageService.generateSignedUrl(
                  item.filePath,
                  { expiresIn, download: false }
                );
                
                let thumbnailSignedUrl: string | undefined;
                if (item.thumbnailPath) {
                  try {
                    thumbnailSignedUrl = await deps.storageService.generateSignedUrl(
                      item.thumbnailPath,
                      { expiresIn, download: false }
                    );
                  } catch (thumbError) {
                    console.warn(`Failed to generate signed URL for thumbnail ${item.id}:`, thumbError);
                  }
                }
                
                fileData = {
                  fileSignedUrl,
                  ...(thumbnailSignedUrl && { thumbnailSignedUrl }),
                  signedUrlExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
                };
              } catch (urlError) {
                console.error(`Failed to generate signed URL for letterhead ${item.id}:`, urlError);
                // Don't add file data if it fails
              }
            }
            
            return {
              ...baseData,
              ...fileData,
            };
          })
        );
  
        return reply.send({
          data: transformedItems,
          pagination: result.pagination,
        });
      } catch (error) {
        console.error('Error listing letterheads:', error);
        
        if (error instanceof LetterheadError) {
          return reply.status(400).send({
            error: {
              code: error.code || 'LIST_FAILED',
              message: error.message || 'Failed to list letterheads',
            },
          });
        }
        
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred while listing letterheads',
          },
        });
      }
    }
  );





 //testing:
 // In your letterhead.routes.ts
// fastify.get('/debug/storage/detailed', async (request, reply) => {
//   try {
//     const storageService = deps.storageService;
//     const debugResult = await storageService.debugStorage();
    
//     return reply.send(debugResult);
//   } catch (error) {
//     console.error('Detailed debug error:', error);
//     return reply.status(500).send({ 
//       error: error instanceof Error ? error.message : 'Unknown error' 
//     });
//   }
// });

 



  fastify.get(
    '/public',
    {
      schema: {
        tags: ['Letterheads'],
        summary: 'List public letterheads',
        description: 'List all public letterheads (no authentication required).',
      },
    },
    async (_request, reply) => {
      const result = await deps.listLetterheadsUseCase.executePublic();
      return reply.send({ data: result });
    }
  );


  fastify.get<{
    Params: { id: string };
    Querystring: {
      securityOption?: 'base64' | 'signed-url';
      expiresIn?: number;
    };
  }>(
    '/:id',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['Letterheads'],
        summary: 'Get letterhead',
        description: 'Get a letterhead by ID with security options.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        //       this for http://localhost:3003/api/v1/pdf/letterheads/abbcd05b-45e0-41ce-a809-aa4ac4ea979a only
        // querystring: {
        //   type: 'object',

        //   properties: {
        //     securityOption: { 
        //       type: 'string', 
        //       enum: ['base64', 'signed-url'],
        //       default: 'signed-url' 
        //     },
        //     expiresIn: { 
        //       type: 'number', 
        //       default: 3600,
        //       minimum: 60,
        //       maximum: 86400
        //     }
        //   },
        // },
        querystring: {
          type: 'object',
          required: ['securityOption'], // enforce presence
          properties: {
            securityOption: { 
              type: 'string', 
              enum: ['base64', 'signed-url'] // only these values
            },
            expiresIn: { 
              type: 'number', 
              default: 3600,
              minimum: 60,
              maximum: 86400
            }
          }
        },
        
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                oneOf: [
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      name: { type: 'string' },
                      
                      
                      description: { type: 'string' },
                      
                      paperSize: { 
                        type: 'string', 
                        enum: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'LETTER', 'LEGAL', 'TABLOID', 'CUSTOM']
                      },
                      orientation: { 
                        type: 'string', 
                        enum: ['PORTRAIT', 'LANDSCAPE']
                      },
                      margins: {
                        type: 'object',
                        properties: {
                          top: { type: 'number' },
                          right: { type: 'number' },
                          bottom: { type: 'number' },
                          left: { type: 'number' }
                        }
                      },
                      safeZones: {
                        type: 'object',
                        properties: {
                          header: {
                            type: 'object',
                            properties: {
                              top: { type: 'number' },
                              bottom: { type: 'number' },
                              left: { type: 'number' },
                              right: { type: 'number' }
                            }
                          },
                          footer: {
                            type: 'object',
                            properties: {
                              top: { type: 'number' },
                              bottom: { type: 'number' },
                              left: { type: 'number' },
                              right: { type: 'number' }
                            }
                          }
                        }
                      },
                      brandColors: { 
                        type: 'array', 
                        items: { type: 'string' },
                        nullable: true 
                      },
                      primaryFont: { type: 'string', nullable: true },
                      secondaryFont: { type: 'string', nullable: true },
                      
                      // File properties
                      fileType: { 
                        type: 'string', 
                        enum: ['IMAGE', 'PDF', 'SVG']
                      },
                      mimeType: { type: 'string' },
                      fileSize: { type: 'number' },
                      width: { type: 'number', nullable: true },
                      height: { type: 'number', nullable: true },
                      dpi: { type: 'number', nullable: true },
                      dimensionsUnit: { 
                        type: 'string', 
                        enum: ['PIXELS', 'POINTS', 'MILLIMETERS', 'INCHES']
                      },
                      colorProfile: { 
                        type: 'string', 
                        enum: ['RGB', 'CMYK', 'GRAYSCALE']
                      },
                      hasBleedArea: { type: 'boolean' },
                      bleedAreaSize: { type: 'number', nullable: true },
                      
                      // Appearance
                      backgroundColor: { type: 'string', nullable: true },
                      opacity: { type: 'number', nullable: true },
                      
                      // Status
                      isActive: { type: 'boolean' },
                      isPublic: { type: 'boolean' },
                      isSystem: { type: 'boolean' },
                      usageCount: { type: 'number' },
                      
                      // Timestamps
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                      lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
                      publishedAt: { type: 'string', format: 'date-time', nullable: true },
                      deletedAt: { type: 'string', format: 'date-time', nullable: true },
                      
                      // Relations
                      parentId: { type: 'string', format: 'uuid', nullable: true },
                      version: { type: 'string' },
                      
                      category: { type: 'string' },
                     
                      fileBase64: { type: 'string' },
                      thumbnailBase64: { type: 'string' },


                    },
                    required: ['id', 'name', 'mimeType', 'fileSize', 'isActive', 'isPublic', 'usageCount', 'createdAt', 'updatedAt', 'fileBase64']
                  },
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      category: { type: 'string' },
                      mimeType: { type: 'string' },
                      fileSize: { type: 'number' },
                      width: { type: 'number' },
                      height: { type: 'number' },
                      dpi: { type: 'number' },
                      backgroundColor: { type: 'string' },
                      opacity: { type: 'number' },
                      isActive: { type: 'boolean' },
                      isPublic: { type: 'boolean' },
                      usageCount: { type: 'number' },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                      fileSignedUrl: { type: 'string' },
                      thumbnailSignedUrl: { type: 'string' },
                      signedUrlExpiresAt: { type: 'string', format: 'date-time' },
                      paperSize: { 
                        type: 'string', 
                        enum: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'LETTER', 'LEGAL', 'TABLOID', 'CUSTOM']
                      },
                      orientation: { 
                        type: 'string', 
                        enum: ['PORTRAIT', 'LANDSCAPE']
                      },
                      margins: {
                        type: 'object',
                        properties: {
                          top: { type: 'number' },
                          right: { type: 'number' },
                          bottom: { type: 'number' },
                          left: { type: 'number' }
                        }
                      },
                      safeZones: {
                        type: 'object',
                        properties: {
                          header: {
                            type: 'object',
                            properties: {
                              top: { type: 'number' },
                              bottom: { type: 'number' },
                              left: { type: 'number' },
                              right: { type: 'number' }
                            }
                          },
                          footer: {
                            type: 'object',
                            properties: {
                              top: { type: 'number' },
                              bottom: { type: 'number' },
                              left: { type: 'number' },
                              right: { type: 'number' }
                            }
                          }
                        }
                      },
                      brandColors: { 
                        type: 'array', 
                        items: { type: 'string' },
                        nullable: true 
                      },
                      primaryFont: { type: 'string', nullable: true },
                      secondaryFont: { type: 'string', nullable: true },
                      
                      // File properties
                      fileType: { 
                        type: 'string', 
                        enum: ['IMAGE', 'PDF', 'SVG']
                      },
                     
                      dimensionsUnit: { 
                        type: 'string', 
                        enum: ['PIXELS', 'POINTS', 'MILLIMETERS', 'INCHES']
                      },
                      colorProfile: { 
                        type: 'string', 
                        enum: ['RGB', 'CMYK', 'GRAYSCALE']
                      },
                      hasBleedArea: { type: 'boolean' },
                      bleedAreaSize: { type: 'number', nullable: true },
                      
                      // Appearance
                    
                      // Status
                   
                      isSystem: { type: 'boolean' },
                    
                      
                      // Timestamps
                   
                      lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
                      publishedAt: { type: 'string', format: 'date-time', nullable: true },
                      deletedAt: { type: 'string', format: 'date-time', nullable: true },
                      
                      // Relations
                      parentId: { type: 'string', format: 'uuid', nullable: true },
                      version: { type: 'string' },
                      
                    

                    },
                    required: ['id', 'name', 'mimeType', 'fileSize', 'isActive', 'isPublic', 'usageCount', 'createdAt', 'updatedAt', 'fileSignedUrl', 'signedUrlExpiresAt']
                  }
                ]
              }
            }
          }
        }
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.sub;
        const { id } = request.params;
        const { securityOption = 'signed-url', expiresIn = 3600 } = request.query;
        const organizationId = request.user!.orgId;
  
        // Call use case with includeFiles: true
        const result = await deps.getLetterheadUseCase.execute(
          userId, 
          id, 
          organizationId,
          {
            includeFiles: true,
            securityOption,
            expiresIn
          }
        );
  
        // Format response based on security option
        const baseResponse = {
          id: result.letterhead.id,
          name: result.letterhead.name,
          description: result.letterhead.description || undefined,
          category: result.letterhead.category || undefined,
          mimeType: result.letterhead.mimeType,
          fileSize: result.letterhead.fileSize,
          width: result.letterhead.width || undefined,
          height: result.letterhead.height || undefined,
          dpi: result.letterhead.dpi || undefined,
          backgroundColor: result.letterhead.backgroundColor || undefined,
          opacity: result.letterhead.opacity || undefined,
          isActive: result.letterhead.isActive,
          isPublic: result.letterhead.isPublic,
          usageCount: result.letterhead.usageCount,
          createdAt: result.letterhead.createdAt,
          updatedAt: result.letterhead.updatedAt,
        
          // Layout properties
          paperSize: result.letterhead.paperSize,
          orientation: result.letterhead.orientation,
          margins: result.letterhead.margins,
          safeZones: result.letterhead.safeZones,
          brandColors: result.letterhead.brandColors || [],
          primaryFont: result.letterhead.primaryFont || undefined,
          secondaryFont: result.letterhead.secondaryFont || undefined,
          
          // File properties
          fileType: result.letterhead.fileType,
        
          dimensionsUnit: result.letterhead.dimensionsUnit,
          colorProfile: result.letterhead.colorProfile,
          hasBleedArea: result.letterhead.hasBleedArea,
          bleedAreaSize: result.letterhead.bleedAreaSize || undefined,
          
          // Appearance
       
          
          // Status
       
          isSystem: result.letterhead.isSystem || false,
    
          
          // Timestamps
         
          lastUsedAt: result.letterhead.lastUsedAt || undefined,
          publishedAt: result.letterhead.publishedAt || undefined,
          deletedAt: result.letterhead.deletedAt || undefined,
          
          // Relations
          parentId: result.letterhead.parentId || undefined,
          version: result.letterhead.version,
          
        };
  
        if (securityOption === 'base64' && result.fileData?.base64) {
          const base64Response: LetterheadBase64Response = {
            ...baseResponse,
            fileBase64: result.fileData.base64,
            thumbnailBase64: result.fileData.thumbnailBase64 || undefined,
          };
          
          return reply.send({
            data: base64Response
          });
        } 
        
        else if (result.fileData?.signedUrl) {
          const signedUrlResponse: LetterheadSignedUrlResponse = {
            ...baseResponse,
            
            fileSignedUrl: result.fileData.signedUrl,
            thumbnailSignedUrl: result.fileData.thumbnailSignedUrl || undefined,
            signedUrlExpiresAt: result.fileData.expiresAt!.toISOString(),
          };
          
          return reply.send({
            data: signedUrlResponse
          });
        }
  
        // If no file data but we requested it, return partial response
        const fallbackResponse: LetterheadBaseData = baseResponse;
        return reply.send({
          data: fallbackResponse
        });
  
      } catch (error) {
        console.error('Error getting letterhead:', error);
        
        if (error instanceof LetterheadNotFoundError) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Letterhead not found'
            }
          });
        }
        
        if (error instanceof LetterheadAccessDeniedError) {
          return reply.status(403).send({
            error: {
              code: 'ACCESS_DENIED',
              message: 'You do not have permission to access this letterhead'
            }
          });
        }
        
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get letterhead'
          }
        });
      }
    }
  );
// /apps/pdf-service/src/presentation/routes/letterhead.routes.ts

fastify.get<{
  Params: { id: string };
  Querystring: {
    securityOption: 'base64' | 'signed-url';
    expiresIn?: number;
  };
}>(
  '/:id/files',
  {
    preHandler: [deps.requireAuth],
    schema: {
      tags: ['Letterheads'],
      summary: 'Get letterhead file data',
      description: 'Get letterhead file data as base64 or signed URL.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        required: ['securityOption'],
        properties: {
          securityOption: { 
            type: 'string', 
            enum: ['base64', 'signed-url'],
            description: 'How to return the file data' 
          },
          expiresIn: { 
            type: 'number', 
            default: 3600,
            minimum: 60,
            maximum: 86400,
            description: 'Expiration in seconds for signed URLs' 
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                fileData: { type: 'string' },
                thumbnailData: { type: 'string' },
                expiresAt: { type: 'string', format: 'date-time' },
                mimeType: { type: 'string' },
              },
              required: ['fileData'],
            },
          },
        },
      },
    },
  },
  async (request, reply) => {
    try {
      const userId = request.user!.sub;
      const { id } = request.params;
      const { securityOption, expiresIn = 3600 } = request.query;
      const organizationId = request.user!.orgId;
  
      // 1. First get the letterhead to check permissions and get file paths
      const getLetterheadResult = await deps.getLetterheadUseCase.execute(
        userId, 
        id, 
        organizationId
      );

       

      const letterhead = getLetterheadResult.letterhead;
      
      if (!letterhead.filePath) {
        return reply.status(404).send({
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'Letterhead file not found',
          },
        });
      }

   
      const fileData = await deps.getLetterheadFileDataUseCase.execute({
        filePath: letterhead.filePath,
        thumbnailPath: letterhead.thumbnailPath || undefined,
        securityOption,
        expiresIn,
      });

      const response: FileDataResponse = {
        fileData: fileData.fileData,
      };
  
    
      if (fileData.thumbnailData) {
        response.thumbnailData = fileData.thumbnailData;
      }
 
      if (fileData.expiresAt) {
        response.expiresAt = fileData.expiresAt.toISOString();
      }

      if (fileData.mimeType) {
        response.mimeType = fileData.mimeType;
      }

      return reply.send({
        data: response,
      });

    } catch (error) {
      console.error('Error getting letterhead file data:', error);
      
      if (error instanceof LetterheadNotFoundError) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Letterhead not found',
          },
        });
      }
      
      if (error instanceof LetterheadAccessDeniedError) {
        return reply.status(403).send({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to access this letterhead',
          },
        });
      }
      
      if (error instanceof LetterheadError) {
        return reply.status(400).send({
          error: {
            code: error.code || 'FILE_RETRIEVAL_FAILED',
            message: error.message || 'Failed to retrieve file data',
          },
        });
      }
      
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    }
  }
);
 
  fastify.get<{ Params: { id: string } }>(
  '/public/:id',
  {
    schema: {
      tags: ['Letterheads'],
      summary: 'Get public letterhead',
      description: 'Get a public letterhead by ID (no authentication required).',
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
      const result = await deps.getLetterheadUseCase.executePublic(id);
      return reply.send({ data: result });
      
    } 
    catch (error: unknown) {
  let code: string | undefined;
  let message: string | undefined;

  if (error instanceof Error) {
    message = error.message;

    // If you have custom errors with a `code` property
    if ('code' in error) {
      code = (error as { code?: string }).code;
    }
  }

  console.error('Public route error:', { code, message });

  switch (code) {
    case 'NOT_FOUND':
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Letterhead not found',
          details: 'The requested letterhead does not exist',
        },
      });

    case 'LETTERHEAD_INACTIVE':
      return reply.status(403).send({
        error: {
          code: 'LETTERHEAD_INACTIVE',
          message: 'Letterhead is not active',
          details: 'This letterhead exists but is currently inactive',
        },
      });

    case 'LETTERHEAD_NOT_PUBLIC':
      return reply.status(403).send({
        error: {
          code: 'LETTERHEAD_NOT_PUBLIC',
          message: 'Letterhead is not public',
          details: 'This letterhead exists but is not publicly accessible',
        },
      });

    case 'ACCESS_DENIED':
      return reply.status(403).send({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied',
          details: message,
        },
      });

    default:
      return reply.status(400).send({
        error: {
          code: 'GET_PUBLIC_FAILED',
          message: 'Failed to get public letterhead',
        },
      });
  }
}

  }
);

fastify.post(
  '/',
  {
    preHandler: [deps.requireAuth, deps.requireSuperAdmin],
    
    preValidation: async (request) => {
      const body = request.body as any;

      if (typeof body?.safeZones === 'string') {
        try {
          body.safeZones = JSON.parse(body.safeZones);
        } 
        catch (err) {
          return Promise.reject({
            statusCode: 400,
            message: 'Invalid safeZones JSON'
          });
        }
      }

      if (typeof body?.margins === 'string') {
        try {
          body.margins = JSON.parse(body.margins);
        } catch (err) {
          return Promise.reject({
            statusCode: 400,
            message: 'Invalid margins JSON'
          });
        }
      }
    },
    
    schema: {
      body: {
        type: 'object',
        required: ['name', 'file'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          category: { type: 'string' },
          backgroundColor: { type: 'string' },
          opacity: { type: 'string' },  
          isActive: { type: 'string' },  
          isPublic: { type: 'string' },  
          isSystem: { type: 'string' }, 
          organizationId: { type: 'string' },
          securityOption: { 
            type: 'string', 
            enum: ['base64', 'signed-url'],
            default: 'base64' 
          },
          expiresIn: { 
            type: 'number', 
            default: 3600,
            description: 'Expiration in seconds for signed URLs (if chosen)' 
          },
           
          hasBleedArea: { type: 'string' },
          bleedAreaSize: { type: 'string' },
          margins: {
            type: 'object',
            properties: {
              top: { type: 'number' },
              right: { type: 'number' },
              bottom: { type: 'number' },
              left: { type: 'number' }
            }
          },
          safeZones: {
            type: 'object',
            properties: {
              header: {
                type: 'object',
                properties: {
                  top: { type: 'number' },
                  bottom: { type: 'number' },
                  left: { type: 'number' },
                  right: { type: 'number' }
                }
              },
              footer: {
                type: 'object',
                properties: {
                  top: { type: 'number' },
                  bottom: { type: 'number' },
                  left: { type: 'number' },
                  right: { type: 'number' }
                }
              }
            }
          }
        },
      },
    },
  },
  async (request, reply) => {
    try {
      const userId = request.user!.sub;
      console.log('=== UPLOAD REQUEST START ===');

      // Define proper interface for request body
    

      const body = request.body as CreateLetterheadData;
 
      const securityOption = body.securityOption || 'base64';
      const expiresIn = body.expiresIn || 3600;

      

      
      const name = (body.name || '').trim();
 

      /* ---------- FILE (BUFFER MODE) ---------- */
      const fileBuffer = body.file;

      if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
        return reply.status(400).send({
          error: 'No file uploaded',
          code: 'NO_FILE',
        });
      }

      console.log('File received:', {
        size: fileBuffer.length,
      });

      if (!name) {
        return reply.status(400).send({
          error: 'Validation Error',
          code: 'NAME_REQUIRED',
          message: 'Letterhead name is required',
        });
      }

      // Use a proper MIME type detection library
      const detectedMimeType = await detectMimeType(fileBuffer);
      
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/webp',
        'image/tiff',
        'image/svg+xml',
        'application/pdf'
      ];
      
      if (!detectedMimeType || !allowedMimeTypes.includes(detectedMimeType)) {
        return reply.status(400).send({
          error: 'Validation Error',
          code: 'INVALID_FILE_TYPE',
          message: `File type "${detectedMimeType || 'unknown'}" not supported. Supported types: ${allowedMimeTypes.join(', ')}`,
        });
      }

      const createInput: CreateLetterheadData = {
        name: (body.name || '').trim(),
        description: (body.description || '').trim() || undefined,
        category: (body.category || '').trim() || undefined,
        backgroundColor: (body.backgroundColor || '').trim() || undefined,
        opacity: parseNumber(body.opacity),
        isActive: parseBoolean(body.isActive ?? true), // Default to true
        isPublic: parseBoolean(body.isPublic ?? false), // Default to false
        isSystem: parseBoolean(body.isSystem ?? false), // Default to false
        organizationId: (body.organizationId || '').trim() || undefined,
        hasBleedArea: parseBoolean(body.hasBleedArea ?? false),
        bleedAreaSize: parseNumber(body.bleedAreaSize),
        securityOption: body.securityOption || 'base64',
        expiresIn: parseNumber(body.expiresIn) || 3600,
        
        // Handle margins with defaults
        margins: body.margins || {
          top: 57.6,
          right: 18,
          bottom: 36,
          left: 18
        },
        
        // Handle safeZones with defaults
        safeZones: body.safeZones || {
          header: {
            top: 72,
            bottom: 144,
            left: 36,
            right: 36
          },
          footer: {
            top: 648,
            bottom: 36,
            left: 36,
            right: 36
          }
        },
        
        // Add other fields with defaults
        paperSize: body.paperSize || 'A4',
        orientation: body.orientation || 'PORTRAIT',
        brandColors: body.brandColors || ['#000000', '#FFFFFF'],
        primaryFont: body.primaryFont,
        secondaryFont: body.secondaryFont,
        dimensionsUnit: body.dimensionsUnit || 'POINTS',
        colorProfile: body.colorProfile || 'RGB',
        version: body.version || '1.0.0',
        
        // File will be added below
        file: body.file
      };

      const fileData: LetterheadFile = {
        data: fileBuffer,
        filename: `letterhead_${Date.now()}`,
        mimetype: detectedMimeType,  
        size: fileBuffer.length,
      };

      const result = await deps.uploadLetterheadUseCase.execute(
        userId,
        createInput,
        fileData
      );
        // ===== SECURITY IMPLEMENTATION =====
        if (securityOption === 'base64') {
          // OPTION 1: Return files as base64
          const fileBuffer = await deps.storageService.downloadFile(result.filePath!);
          const fileBase64 = fileBuffer.toString('base64');
          
          let thumbnailBase64: string | undefined;
          if (result.thumbnailPath) {
            const thumbBuffer = await deps.storageService.downloadFile(result.thumbnailPath);
            thumbnailBase64 = thumbBuffer.toString('base64');
          }
  
          return reply.status(201).send({
            data: {
              id: result.id,
              name: result.name,
              fileBase64: `data:${result.mimeType};base64,${fileBase64}`,
              thumbnailBase64: thumbnailBase64 
                ? `data:image/jpeg;base64,${thumbnailBase64}`
                : undefined,
              createdAt: result.createdAt,
            },
            message: 'Letterhead uploaded successfully (base64)',
          });
          
        } else {
          // OPTION 2: Generate signed URLs
          const fileSignedUrl = await deps.storageService.generateSignedUrl(
            result.filePath!,
            { expiresIn, download: false }
          );
          
          let thumbnailSignedUrl: string | undefined;
          if (result.thumbnailPath) {
            thumbnailSignedUrl = await deps.storageService.generateSignedUrl(
              result.thumbnailPath,
              { expiresIn, download: false }
            );
          }
  
          return reply.status(201).send({
            data: {
              id: result.id,
              name: result.name,
              fileSignedUrl, // Time-limited signed URL
              thumbnailSignedUrl,
              signedUrlExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
              createdAt: result.createdAt,
            },
            message: 'Letterhead uploaded successfully (signed URL)',
          });
        }

      
    } catch (err) {
      console.error('UPLOAD ERROR', err);
      
      if (err instanceof LetterheadValidationError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
            details: err.details,
          },
        });
      }
      
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    }
  }
);



 

fastify.put<{ 
  Params: { id: string }; 
  Body: Omit<UpdateLetterheadData, 'file'>
}>(
  '/:id',
  {
    preHandler: [deps.requireAuth],
    schema: {
      tags: ['Letterheads'],
      summary: 'Update letterhead metadata',
      description: 'Update letterhead metadata (name, description, settings). Does NOT update file.',
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
          name: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 100,
            nullable: true 
          },
          description: { 
            type: 'string', 
            maxLength: 500, 
            nullable: true 
          },
          category: { 
            type: 'string', 
            maxLength: 50, 
            nullable: true 
          },
          backgroundColor: { 
            type: 'string', 
            pattern: '^#[0-9A-Fa-f]{6}$', 
            nullable: true 
          },
          opacity: { 
            type: 'number', 
            minimum: 0, 
            maximum: 1, 
            nullable: true 
          },
          isActive: { 
            type: 'boolean', 
            nullable: true 
          },
          isPublic: { 
            type: 'boolean', 
            nullable: true 
          },
          organizationId: { 
            type: 'string', 
            format: 'uuid', 
            nullable: true 
          },
          // Layout properties
          paperSize: { 
            type: 'string', 
            enum: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'LETTER', 'LEGAL', 'TABLOID', 'CUSTOM'],
            nullable: true 
          },
          orientation: { 
            type: 'string', 
            enum: ['PORTRAIT', 'LANDSCAPE'],
            nullable: true 
          },
          margins: { 
            type: 'object',
            nullable: true,
            properties: {
              top: { type: 'number' },
              right: { type: 'number' },
              bottom: { type: 'number' },
              left: { type: 'number' }
            }
          },
          safeZones: { 
            type: 'object',
            nullable: true,
            properties: {
              header: {
                type: 'object',
                properties: {
                  top: { type: 'number' },
                  bottom: { type: 'number' },
                  left: { type: 'number' },
                  right: { type: 'number' }
                }
              },
              footer: {
                type: 'object',
                properties: {
                  top: { type: 'number' },
                  bottom: { type: 'number' },
                  left: { type: 'number' },
                  right: { type: 'number' }
                }
              }
            }
          },
          brandColors: { 
            type: 'array', 
            items: { type: 'string' },
            nullable: true 
          },
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
                description: { type: 'string', nullable: true },
                category: { type: 'string', nullable: true },
                backgroundColor: { type: 'string', nullable: true },
                opacity: { type: 'number', nullable: true },
                isActive: { type: 'boolean' },
                isPublic: { type: 'boolean' },
                paperSize: { type: 'string' },
                orientation: { type: 'string' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    },
  },
  async (request, reply) => {
    try {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const { id } = request.params;
      const data = request.body;

      const result = await deps.updateLetterheadUseCase.execute(
        userId, 
        id, 
        data, 
        organizationId
      );
      
      return reply.send({ 
        data: {
          id: result.id,
          name: result.name,
          description: result.description,
          category: result.category,
          backgroundColor: result.backgroundColor,
          opacity: result.opacity,
          isActive: result.isActive,
          isPublic: result.isPublic,
          paperSize: result.paperSize,
          orientation: result.orientation,
          updatedAt: result.updatedAt
        }
      });
      
    } catch (error) {
      console.error('Error updating letterhead metadata:', error);
      
      if (error instanceof LetterheadNotFoundError) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Letterhead not found'
          }
        });
      }
      
      if (error instanceof LetterheadAccessDeniedError) {
        return reply.status(403).send({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to update this letterhead'
          }
        });
      }
      
      if (error instanceof LetterheadValidationError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            details: error.details
          }
        });
      }
      
      if (error instanceof LetterheadDuplicateError) {
        return reply.status(409).send({
          error: {
            code: 'DUPLICATE_ENTRY',
            message: error.message
          }
        });
      }
      
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update letterhead'
        }
      });
    }
  }
);
 

fastify.put<{ 
  Params: { id: string }; 
}>(
  '/:id/file',
  {
    preHandler: [deps.requireAuth],
    attachValidation: false,
    
    
  },
  async (request, reply) => {
    try {
      if (request.validationError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: request.validationError.message
          }
        });
      }
      
      console.log('Is multipart?', request.isMultipart());
      console.log('Headers:', request.headers);
      
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const { id } = request.params;
      
      // Get security options from query params instead of body
      const query = request.query as any;
      const securityOption = (query.securityOption || 'base64') as 'base64' | 'signed-url';
      const expiresIn = parseInt(query.expiresIn || '3600', 10);
      
      console.log('DEBUG: Security options:', { securityOption, expiresIn });
      
      // Since you're using attachFieldsToBody: 'keyValues', 
      // the file will be in request.body, not via request.file()
      const body = await request.body;
      
      // The file field name might be 'file' or something else
      // Check what field name you're using in your Bruno/API client
      // 'body' is of type unknown, so we need to assert/cast it as an object first
      const fileField = (body as any)?.file;

      if (!fileField) {
        console.log('DEBUG: Body received:', body);
        // Only print available fields if body is an object
        if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
          console.log('DEBUG: Available fields:', Object.keys(body as object));
        } else {
          console.log('DEBUG: Body is not an object or is Buffer.');
        }
        return reply.status(400).send({
          error: {
            code: 'NO_FILE',
            message: 'No file provided in request. Make sure to include a file in multipart/form-data'
          }
        });
      }
      
      // With attachFieldsToBody: 'keyValues', fileField should contain the file data
      console.log('DEBUG: File field received:', {
        type: typeof fileField,
        isBuffer: Buffer.isBuffer(fileField),
        isObject: typeof fileField === 'object',
        keys: fileField ? Object.keys(fileField) : []
      });
      
      let fileBuffer: Buffer;
      let filename: string;
      let mimetype: string;
      
      // The structure depends on how fastify-multipart attaches files with keyValues
      // It might be different, so we need to check the actual structure
      if (fileField && fileField.value) {
        // If it's structured as { value: Buffer, filename: string, mimetype: string, ... }
        fileBuffer = fileField.value;
        filename = fileField.filename || `letterhead_${Date.now()}`;
        mimetype = fileField.mimetype || 'application/octet-stream';
      } else if (Buffer.isBuffer(fileField)) {
        // If it's just a Buffer directly
        fileBuffer = fileField;
        filename = `letterhead_${Date.now()}`;
        mimetype = 'application/octet-stream';
      } else {
        // Try to parse as a different structure
        console.log('DEBUG: Unexpected file field structure:', fileField);
        return reply.status(400).send({
          error: {
            code: 'INVALID_FILE_FORMAT',
            message: 'File format is not valid'
          }
        });
      }
      
      console.log('DEBUG: File received:', {
        filename,
        mimetype,
        size: fileBuffer.length
      });
      
      // Detect mime type from buffer (more reliable)
      const detectedMimeType = await detectMimeType(fileBuffer);
      const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
        'image/tiff', 'image/svg+xml', 'application/pdf'
      ];
      
      if (!detectedMimeType || !allowedMimeTypes.includes(detectedMimeType)) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `File type "${detectedMimeType || 'unknown'}" not supported`
          }
        });
      }
      
      // Use detected mime type instead of provided one
      mimetype = detectedMimeType;
      
      // Create file data object
      const fileData: LetterheadFile = {
        data: fileBuffer,
        filename: filename,
        mimetype: mimetype,
        size: fileBuffer.length
      };
      
      // ... rest of your code remains the same
        // Update file using the use case
        const result = await deps.updateLetterheadFileUseCase.execute(
          userId,
          id,
          fileData,
          organizationId
        );
        
        // Prepare response based on security option
        const baseResponse = {
          id: result.letterhead.id,
          name: result.letterhead.name,
          fileSize: result.letterhead.fileSize,
          mimeType: result.letterhead.mimeType,
          width: result.letterhead.width || undefined,
          height: result.letterhead.height || undefined,
          dpi: result.letterhead.dpi || undefined,
          updatedAt: result.letterhead.updatedAt
        };
        
        if (securityOption === 'base64') {
          // Download and return as base64
          const downloadedFileBuffer = await deps.storageService.downloadFile(result.letterhead.filePath!);
          const fileBase64 = `data:${result.letterhead.mimeType};base64,${downloadedFileBuffer.toString('base64')}`;
          
          let thumbnailBase64: string | undefined;
          if (result.letterhead.thumbnailPath) {
            try {
              const thumbBuffer = await deps.storageService.downloadFile(result.letterhead.thumbnailPath);
              thumbnailBase64 = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
            } catch (error) {
              console.warn('Failed to get thumbnail:', error);
            }
          }
          
          const base64Response = {
            ...baseResponse,
            fileBase64,
            thumbnailBase64
          };
          
          return reply.send({ data: base64Response });
          
        } else {
          // Generate signed URLs
          if (!result.letterhead.filePath) {
            return reply.status(500).send({
              error: {
                code: 'MISSING_FILE_PATH',
                message: 'Letterhead file path is missing'
              }
            });
          }
          
          const fileSignedUrl = await deps.storageService.generateSignedUrl(
            result.letterhead.filePath,
            { expiresIn, download: false }
          );
          
          let thumbnailSignedUrl: string | undefined;
          if (result.letterhead.thumbnailPath) {
            try {
              thumbnailSignedUrl = await deps.storageService.generateSignedUrl(
                result.letterhead.thumbnailPath,
                { expiresIn, download: false }
              );
            } catch (error) {
              console.warn('Failed to generate thumbnail signed URL:', error);
            }
          }
          
          const signedUrlResponse = {
            ...baseResponse,
            fileSignedUrl,
            thumbnailSignedUrl,
            signedUrlExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
          };
          
          return reply.send({ data: signedUrlResponse });
        }
        
      } catch (error) {
        console.error('Error updating letterhead file:', error);
        
        if (error instanceof LetterheadNotFoundError) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Letterhead not found'
            }
          });
        }
        
        if (error instanceof LetterheadAccessDeniedError) {
          return reply.status(403).send({
            error: {
              code: 'ACCESS_DENIED',
              message: 'You do not have permission to update this letterhead file'
            }
          });
        }
        
        if (error instanceof StorageError) {
          return reply.status(400).send({
            error: {
              code: 'STORAGE_ERROR',
              message: error.message
            }
          });
        }
        
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update letterhead file'
          }
        });
      }
    }
);

 











fastify.patch<{ 
  Params: { id: string }; 
  Body: Partial<UpdateLetterheadData>
}>(
  '/:id',
  {
    preHandler: [deps.requireAuth],
    schema: {
      tags: ['Letterheads'],
      summary: 'Partially update letterhead',
      description: 'Partially update letterhead fields (PATCH method).',
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
          name: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 100,
            nullable: true 
          },
          description: { 
            type: 'string', 
            maxLength: 500, 
            nullable: true 
          },
          category: { 
            type: 'string', 
            maxLength: 50, 
            nullable: true 
          },
          backgroundColor: { 
            type: 'string', 
            pattern: '^#[0-9A-Fa-f]{6}$', 
            nullable: true 
          },
          opacity: { 
            type: 'number', 
            minimum: 0, 
            maximum: 1, 
            nullable: true 
          },
          isActive: { 
            type: 'boolean', 
            nullable: true 
          },
          isPublic: { 
            type: 'boolean', 
            nullable: true 
          },
          usageCount: { 
            type: 'number', 
            minimum: 0,
            nullable: true 
          },
          lastUsedAt: { 
            type: 'string', 
            format: 'date-time',
            nullable: true 
          }
        },
        minProperties: 1  // At least one property must be provided
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
                description: { type: 'string', nullable: true },
                category: { type: 'string', nullable: true },
                isActive: { type: 'boolean' },
                isPublic: { type: 'boolean' },
                usageCount: { type: 'number' },
                lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    },
  },
  async (request, reply) => {
    try {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
      const { id } = request.params;
      const data = request.body;

      // Check if body is empty
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({
          error: {
            code: 'EMPTY_PATCH',
            message: 'Patch body must contain at least one field to update'
          }
        });
      }

      const result = await deps.patchLetterheadUseCase.execute(
        userId, 
        id, 
        data, 
        organizationId
      );
      
      return reply.send({ 
        data: {
          id: result.id,
          name: result.name,
          description: result.description,
          category: result.category,
          isActive: result.isActive,
          isPublic: result.isPublic,
          usageCount: result.usageCount,
          lastUsedAt: result.lastUsedAt?.toISOString(),
          updatedAt: result.updatedAt
        }
      });
      
    } catch (error) {
      console.error('Error patching letterhead:', error);
      
      if (error instanceof LetterheadNotFoundError) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Letterhead not found'
          }
        });
      }
      
      if (error instanceof LetterheadAccessDeniedError) {
        return reply.status(403).send({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to update this letterhead'
          }
        });
      }
      
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update letterhead'
        }
      });
    }
  }
);

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [deps.requireAuth, deps.requireSuperAdmin],
      schema: {
        tags: ['Letterheads'],
        summary: 'Delete letterhead',
        description: 'Delete a letterhead (SUPERADMIN only).',
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

      await deps.deleteLetterheadUseCase.execute(userId, id, organizationId);
      return reply.status(204).send();
    }
  );


 fastify.post<{ 
  Params: { id: string }; 
  Body: { 
    newName: string;
    description?: string;
    isActive?: boolean;
    isPublic?: boolean;
    organizationId?: string;
  } 
}>(
  '/:id/clone',
  {
    preHandler: [deps.requireAuth],  
    attachValidation: true, 
    schema: {
      tags: ['Letterheads'],
      summary: 'Clone letterhead',
      description: 'Create a copy of an existing letterhead with a new name.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['newName'],
        properties: {
          newName: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 100,
            pattern: '^[a-zA-Z0-9\\s\\-\\._]+$', 
            description: 'Name for the cloned letterhead (letters, numbers, spaces, dots, dashes, underscores only)' 
          },
          description: { 
            type: 'string', 
            maxLength: 500,
            nullable: true,
            description: 'Optional description override'
          },
          isActive: { 
            type: 'boolean',
            default: true,
            description: 'Whether the cloned letterhead should be active'
          },
          isPublic: { 
            type: 'boolean',
            default: false,
            description: 'Whether the cloned letterhead should be public'
          },
          organizationId: { 
            type: 'string', 
            format: 'uuid',
            nullable: true,
            description: 'Optional organization ID override'
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                description: { type: 'string', nullable: true },
                fileSize: { type: 'number' },
                mimeType: { type: 'string' },
                isActive: { type: 'boolean' },
                isPublic: { type: 'boolean' },
                parentId: { type: 'string', format: 'uuid', nullable: true },
                createdAt: { type: 'string', format: 'date-time' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },
  async (request, reply) => {
    // Add validation error handling
    if (request.validationError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: request.validationError.message
        }
      });
    }
    const userOrganizationId = request.user!.orgId;
    const userId = request.user!.sub;
    const organizationId = request.user!.orgId;
    const { id } = request.params;
    const { newName, description, isActive, isPublic } = request.body;
    if (!newName || newName.trim().length === 0) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_INPUT',
          message: 'Letterhead name cannot be empty'
        }
      });
    }
    try {
      const finalOrganizationId = organizationId || userOrganizationId;

      const result = await deps.cloneLetterheadUseCase.execute(
        userId,
        id,
        {
          newName: newName.trim(),
          description,
          isActive: isActive !== undefined ? isActive : true,
          isPublic: isPublic !== undefined ? isPublic : false,
          organizationId: finalOrganizationId,
        }
      );


      return reply.status(201).send({ 
        data: {
          id: result.id,
          name: result.name,
          description: result.description,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          isActive: result.isActive,
          isPublic: result.isPublic,
          parentId: result.parentId,  
          createdAt: result.createdAt
        },
        message: 'Letterhead cloned successfully'
      });
    } catch (error) {
      if (error instanceof LetterheadError) {
        const statusCode = error.code === 'NOT_FOUND' ? 404 : 
                          error.code === 'DUPLICATE_ENTRY' ? 409 : 400;
        return reply.status(statusCode).send({
          error: {
            code: error.code,
            message: error.message
          }
        });
      }
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to clone letterhead'
        }
      });
    }
  }
);

  fastify.post<{ Params: { id: string } }>(
    '/:id/restore',
    {
      preHandler: [deps.requireAuth, deps.requireSuperAdmin],
      schema: {
        tags: ['Letterheads'],
        summary: 'Restore letterhead',
        description: 'Restore a soft-deleted letterhead (SUPERADMIN only).',
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

      const result = await deps.updateLetterheadUseCase.execute(userId, id, { deletedAt: null }, organizationId);
      return reply.send({ data: result });
    }
  );


  fastify.post<{ Params: { id: string } }>(
    '/:id/publish',
    {
      preHandler: [deps.requireAuth, deps.requireSuperAdmin],
      schema: {
        tags: ['Letterheads'],
        summary: 'Publish letterhead',
        description: 'Make a letterhead publicly accessible (SUPERADMIN only).',
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

      const result = await deps.updateLetterheadUseCase.execute(userId, id, {
        isPublic: true,
      }, organizationId);

      return reply.send({ data: result });
    }
  );


  fastify.post<{ Params: { id: string } }>(
    '/:id/unpublish',
    {
      preHandler: [deps.requireAuth, deps.requireSuperAdmin],
      schema: {
        tags: ['Letterheads'],
        summary: 'Unpublish letterhead',
        description: 'Make a letterhead private (SUPERADMIN only).',
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

      const result = await deps.updateLetterheadUseCase.execute(userId, id, {
        isPublic: false,
      }, organizationId);

      return reply.send({ data: result });
    }
  );


  fastify.get(
    '/categories',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['Letterheads'],
        summary: 'List letterhead categories with usage counts',
        description: 'List all unique categories used in letterheads with their total usage count.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['category', 'usageCount'],
                  properties: {
                    category: { type: 'string' },
                    usageCount: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;
  
      const categories = await deps.listLetterheadsUseCase.executeCategories(userId, organizationId);
      return reply.send({ data: categories });
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/:id/usage',
    {
      preHandler: [deps.requireAuth],
      schema: {
        tags: ['Letterheads'],
        summary: 'Track letterhead usage',
        description: 'Increment usage count for a letterhead.',
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


  const letterhead = await deps.getLetterheadUseCase.execute(userId, id, organizationId);
  
  const result = await deps.updateLetterheadUseCase.execute(userId, id, {
    usageCount: (letterhead.letterhead.usageCount || 0) + 1,
  }, organizationId);

  return reply.send({ data: result });
}
  );


  fastify.get(
    '/stats',
    {
      preHandler: [deps.requireAuth, deps.requireSuperAdmin],
      schema: {
        tags: ['Letterheads'],
        summary: 'Get letterhead statistics',
        description: 'Get usage statistics for all letterheads (SUPERADMIN only).',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const organizationId = request.user!.orgId;

      const stats = await deps.listLetterheadsUseCase.executeStats(userId, organizationId);
      return reply.send({ data: stats });
    }
  );
}

 
