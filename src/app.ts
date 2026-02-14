
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';

import { loadConfig } from './infrastructure/config.js';
import { getPrismaClient, disconnectPrisma } from './infrastructure/database/prisma.js';
import { errorHandler } from './presentation/error-handler.js';
import { swaggerOptions, swaggerUiOptions } from './presentation/swagger.js';
 

import { SupabaseTokenService } from './infrastructure/services/token-service.js';
import { SupabaseStorageService } from './infrastructure/services/supabase-storage-service.js';


import { createAuthMiddleware, createSuperAdminMiddleware } from './presentation/middleware/auth-middleware.js';


import { CreatePdfTemplateUseCase } from './application/use-cases/pdf-templates/create-pdf-template.usecase.js';
import { GetPdfTemplateUseCase } from './application/use-cases/pdf-templates/get-pdf-template.usecase.js';
import { ListPdfTemplatesUseCase } from './application/use-cases/pdf-templates/list-pdf-templates.usecase.js';
import { UpdatePdfTemplateUseCase } from './application/use-cases/pdf-templates/update-pdf-template.usecase.js';
import { DeletePdfTemplateUseCase } from './application/use-cases/pdf-templates/delete-pdf-template.usecase.js';

// import { ClonePdfTemplateUseCase } from './application/use-cases/pdf-templates/clone-pdf-template.usecase.js';
// import { GetPdfTemplateStatsUseCase } from './application/use-cases/pdf-templates/get-pdf-template-stats.usecase.js';

import { GeneratePdfUseCase } from './application/use-cases/pdf-generation/generate-pdf.usecase.js';
import { GeneratePreviewUseCase } from './application/use-cases/pdf-generation/generate-preview.usecase.js';
import { GetPdfDocumentUseCase } from './application/use-cases/pdf-generation/get-pdf-document.usecase.js';
import { ListPdfDocumentsUseCase } from './application/use-cases/pdf-generation/list-pdf-documents.usecase.js';
import { DeletePdfDocumentUseCase } from './application/use-cases/pdf-generation/delete-pdf-document.usecase.js';
import { DownloadPdfDocumentUseCase } from './application/use-cases/pdf-generation/download-pdf-document.usecase.js';


import { CreateLetterheadUseCase } from './application/use-cases/letterheads/create-letterhead.usecase.js';
import { ListLetterheadsUseCase } from './application/use-cases/letterheads/list-letterheads.usecase.js';
import { GetLetterheadUseCase } from './application/use-cases/letterheads/get-letterhead.usecase.js';
import { UpdateLetterheadUseCase } from './application/use-cases/letterheads/update-letterhead.usecase.js';
import { DeleteLetterheadUseCase } from './application/use-cases/letterheads/delete-letterhead.usecase.js';


import { CreatePdfGenerationJobUseCase } from './application/use-cases/pdf-jobs/create-pdf-generation-job.usecase.js';
import { GetPdfGenerationJobUseCase } from './application/use-cases/pdf-jobs/get-pdf-generation-job.usecase.js';
import { ListPdfGenerationJobsUseCase } from './application/use-cases/pdf-jobs/list-pdf-generation-jobs.usecase.js';
import { CancelPdfGenerationJobUseCase } from './application/use-cases/pdf-jobs/cancel-pdf-generation-job.usecase.js';


import { PrismaPdfTemplateRepository } from './infrastructure/repositories/pdf-template-repository.js';
import { PrismaPdfDocumentRepository } from './infrastructure/repositories/pdf-document-repository.js';
import { PrismaLetterheadRepository } from './infrastructure/repositories/letterhead-repository.js';
import { PrismaPdfGenerationJobRepository } from './infrastructure/repositories/pdf-generation-job-repository.js';



import { PdfGeneratorService } from './infrastructure/services/pdf-generator-service.js';
 

import { pdfTemplateRoutes } from './presentation/routes/pdf-template.routes.js';
import { pdfGenerationRoutes } from './presentation/routes/pdf-generation.routes.js';
import { letterheadRoutes } from './presentation/routes/letterhead.routes.js';
import { pdfJobRoutes } from './presentation/routes/pdf-job.routes.js';
import { publicPdfRoutes } from './presentation/routes/public-pdf.routes.js';
import { ClonePdfTemplateUseCase } from '@application/use-cases/pdf-templates/clone-pdf-template.usecase.js';
import { RestorePdfTemplateUseCase } from '@application/use-cases/pdf-templates/restore-pdf-template.usecase.js';
import { CloneLetterheadUseCase } from '@application/use-cases/letterheads/clone-letterhead.usecase.js';
 
import { ConsoleLogger, ILogger, TypedLogger } from '@infrastructure/logger/logger.js';
import { ImageProcessor } from '@shared/letterhead/image-processor.js';
import { GetLetterheadFileDataUseCase } from '@application/use-cases/letterheads/get-letterhead-file-data.usecase.js';
import { ThumbnailGenerator } from '@infrastructure/services/thumbnail-generator.js';
import { createClient } from '@supabase/supabase-js';
import { UpdateLetterheadFileUseCase } from '@application/use-cases/letterheads/update-letterhead-fileusecase.js';
import { PatchLetterheadUseCase } from '@application/use-cases/letterheads/patch-letterhead.usecase.js';
import { BUCKET_NAME } from '@shared/letterhead/lettherhead.js';

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig();
  const prisma = getPrismaClient();

  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'debug' : 'info',
    },
    bodyLimit: 10 * 1024 * 1024,  
  });


  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  await fastify.register(rateLimit, {
    max: config.RATE_LIMIT_MAX || 100,
    timeWindow: config.RATE_LIMIT_WINDOW_MS || 60000,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
  });


  if (config.NODE_ENV === 'development') {
    await fastify.register(swagger, swaggerOptions);
    await fastify.register(swaggerUi, swaggerUiOptions);
  }


  fastify.setErrorHandler(errorHandler);


await fastify.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
attachFieldsToBody: 'keyValues'

});



  const tokenService = new SupabaseTokenService(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

 
const NullLogger: ILogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
};

  const pdfGeneratorService = new PdfGeneratorService();


  const pdfTemplateRepo = new PrismaPdfTemplateRepository(prisma);
  const pdfDocumentRepo = new PrismaPdfDocumentRepository(prisma);
  const letterheadRepo = new PrismaLetterheadRepository(prisma);
  const pdfGenerationJobRepo = new PrismaPdfGenerationJobRepository(prisma, NullLogger);
 

  const requireAuth = createAuthMiddleware(tokenService);
  const requireSuperAdmin = createSuperAdminMiddleware();
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const generator = new ThumbnailGenerator(supabase,config.Thumbnail_STORAGE_BUCKET || 'thumbnails',);
  

 
  const imageProcessor = new ImageProcessor({
    executablePath: process.env.CHROME_PATH,  
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    
  },generator);
  const createPdfTemplateUseCase = new CreatePdfTemplateUseCase(pdfTemplateRepo);
  const getPdfTemplateUseCase = new GetPdfTemplateUseCase(pdfTemplateRepo );
  const listPdfTemplatesUseCase = new ListPdfTemplatesUseCase(pdfTemplateRepo);
  const updatePdfTemplateUseCase = new UpdatePdfTemplateUseCase(pdfTemplateRepo);
  const deletePdfTemplateUseCase = new DeletePdfTemplateUseCase(pdfTemplateRepo);
   const storageService = new SupabaseStorageService(
    
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    config.SUPABASE_STORAGE_BUCKET || BUCKET_NAME,
    generator,
    imageProcessor
   
  );

  

  const generatePdfUseCase = new GeneratePdfUseCase(
    pdfTemplateRepo,
    pdfDocumentRepo,
    pdfGeneratorService,
    storageService,
 
  );

  const generatePreviewUseCase = new GeneratePreviewUseCase(
    pdfTemplateRepo,
    pdfDocumentRepo,
    pdfGeneratorService,
    storageService,
    NullLogger
  );

  const getPdfDocumentUseCase = new GetPdfDocumentUseCase(pdfDocumentRepo);
  const listPdfDocumentsUseCase = new ListPdfDocumentsUseCase(pdfDocumentRepo);
  const deletePdfDocumentUseCase = new DeletePdfDocumentUseCase(pdfDocumentRepo, storageService);
  const downloadPdfDocumentUseCase = new DownloadPdfDocumentUseCase(
    pdfDocumentRepo,
    storageService,
    NullLogger
  );

  const uploadLetterheadUseCase = new CreateLetterheadUseCase(
    letterheadRepo,
    storageService,
    imageProcessor, // Pass the actual instance, not a mock
    NullLogger,
    {
      maxFileSize: 10 * 1024 * 1024, // 10MB (increased from 5MB for PDFs)
      allowedMimeTypes: [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
        'image/tiff',
        'image/bmp',
        'image/svg+xml',
        'application/pdf'
      ],
      defaultDpi: 300,
      thumbnailWidth: 300,
      thumbnailHeight: 300,
      thumbnailQuality: 85,
    }
  );
  const getLetterheadFileDataUseCase = new GetLetterheadFileDataUseCase(storageService);
  const listLetterheadsUseCase = new ListLetterheadsUseCase(letterheadRepo);
  const getLetterheadUseCase = new GetLetterheadUseCase(letterheadRepo,storageService);
  const updateLetterheadUseCase = new UpdateLetterheadUseCase(letterheadRepo, storageService);
  const deleteLetterheadUseCase = new DeleteLetterheadUseCase(letterheadRepo, storageService);
const cloneLetterheadUseCase = new CloneLetterheadUseCase(
  letterheadRepo,
  storageService,
 supabase,
 NullLogger,
 {
  maxFileSize: 10 * 1024 * 1024, // 10MB (increased from 5MB for PDFs)
  allowedMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/bmp',
    'image/svg+xml',
    'application/pdf'
  ],
  defaultDpi: 300,
  thumbnailWidth: 300,
  thumbnailHeight: 300,
  thumbnailQuality: 85,
});

  const createPdfGenerationJobUseCase = new CreatePdfGenerationJobUseCase(
    pdfGenerationJobRepo,
    pdfTemplateRepo
  );
  const getPdfGenerationJobUseCase = new GetPdfGenerationJobUseCase(pdfGenerationJobRepo);
  const listPdfGenerationJobsUseCase = new ListPdfGenerationJobsUseCase(pdfGenerationJobRepo);
  const cancelPdfGenerationJobUseCase = new CancelPdfGenerationJobUseCase(pdfGenerationJobRepo);
   const clonePdfTemplateUseCase=new ClonePdfTemplateUseCase(pdfTemplateRepo)
   const restorePdfTemplateUseCase=new RestorePdfTemplateUseCase(pdfTemplateRepo)
 

   const updateLetterheadFileUseCase=new UpdateLetterheadFileUseCase(letterheadRepo,storageService);
   const patchLetterheadUseCase=new PatchLetterheadUseCase(letterheadRepo);


  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'pdf-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  }));




  await fastify.register(
    async (instance) => {
      await pdfTemplateRoutes(instance, {
        createPdfTemplateUseCase,
        getPdfTemplateUseCase,
        listPdfTemplatesUseCase,
        updatePdfTemplateUseCase,
        deletePdfTemplateUseCase,
       clonePdfTemplateUseCase,
       restorePdfTemplateUseCase,
        requireAuth,
      });
    },
    { prefix: '/api/v1/pdf/templates' }
  );


  await fastify.register(
    async (instance) => {
      await pdfGenerationRoutes(instance, {
        generatePdfUseCase,
        generatePreviewUseCase,
        getPdfDocumentUseCase,
        listPdfDocumentsUseCase,
        deletePdfDocumentUseCase,
        downloadPdfDocumentUseCase,
        requireAuth,
      });
    },
    { prefix: '/api/v1/pdf' }
  );


  await fastify.register(
    async (instance) => {
      await letterheadRoutes(instance, {
        uploadLetterheadUseCase,
        listLetterheadsUseCase,
        getLetterheadUseCase,
        updateLetterheadUseCase,
        deleteLetterheadUseCase,
        cloneLetterheadUseCase,
        getLetterheadFileDataUseCase,
        updateLetterheadFileUseCase,
        patchLetterheadUseCase,
        
        storageService,
        
        requireAuth,
        requireSuperAdmin,
      });
    },
    { prefix: '/api/v1/pdf/letterheads' }
  );


  await fastify.register(
    async (instance) => {
      await pdfJobRoutes(instance, {
        createPdfGenerationJobUseCase,
        getPdfGenerationJobUseCase,
        listPdfGenerationJobsUseCase,
        cancelPdfGenerationJobUseCase,
        
        requireAuth,
      });
    },
    { prefix: '/api/v1/pdf/jobs' }
  );


  await fastify.register(
    async (instance) => {
      await publicPdfRoutes(instance, {
        getPdfTemplateUseCase,
        generatePdfUseCase,
        generatePreviewUseCase,
        getPdfDocumentUseCase,
        downloadPdfDocumentUseCase,
      });
    },
    { prefix: '/api/v1/pdf' } 
  );


  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
    });
  });


  fastify.addHook('onReady', async () => {
    try {

      await prisma.$queryRaw`SELECT 1`;
      fastify.log.info('Database connection established');
    } 
  catch (error) {
  if (error instanceof Error) {
    fastify.log.error(error, 'Database connection failed');
  } else {
    fastify.log.error(new Error(String(error)), 'Database connection failed');
  }
  throw error;
}

  });

  fastify.addHook('onClose', async () => {
    await disconnectPrisma();
  });

  return fastify;
}
 
