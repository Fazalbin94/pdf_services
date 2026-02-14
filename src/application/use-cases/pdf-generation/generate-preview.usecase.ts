import { ExtractedVariables, GeneratePreviewData, TemplateData } from "@application/dto/generate-pdf.dto.js";
import { ILogger } from "@infrastructure/logger/logger.js";
 import { PdfDocumentRepository } from "@application/interfaces/pdf-document-repository.interface.js";
import { PdfTemplateRepository } from "@application/interfaces/pdf-template-repository.js";
import { IStorageService } from "@application/interfaces/storage-service.js";

import { PdfDocument } from "@domain/entities/pdf-document.entity.js";
import { PdfGenerationError, PdfTemplateNotFoundError } from "@domain/errors/index.js";
import { PdfGeneratorService } from "@infrastructure/services/pdf-generator-service.js";
 import { isVariables, VariableType } from "@application/dto/pdf-template.dto.js";
import { ValidationsError } from "@application/interfaces/validation.js";
import { mapPrismaTemplateToDomain } from "@infrastructure/mappers/pdf-template.mapper.js";
import { extractVariables, validateData } from "@shared/utils/validateData.js";

 
export class GeneratePreviewUseCase {
  constructor(
    private readonly pdfTemplateRepository: PdfTemplateRepository,
    private readonly pdfDocumentRepository: PdfDocumentRepository,
    private readonly pdfGeneratorService: PdfGeneratorService,
    private readonly storageService: IStorageService,
     private readonly logger: ILogger
  ) {}

async execute(
  templateId: string,
  data: TemplateData,
  userId?: string,
  options?: GeneratePreviewData['options']
): Promise<PdfDocument> {
    try {
 this.logger.info('Starting PDF preview generation', {
        templateId,
        userId,
        dataKeys: Object.keys(data),
      });
      const template = await this.pdfTemplateRepository.findById(templateId);
      if (!template || !template.isActive) {
        throw new PdfTemplateNotFoundError(templateId);
      }


      if (!template.isPublic && userId && template.userId !== userId) {
        throw new PdfGenerationError('ACCESS_DENIED', 'You do not have access to this template');
      }


 const domainTemplate = mapPrismaTemplateToDomain(template);

    // 3. Check access (use domain template)
    if (!domainTemplate.isPublic && userId && domainTemplate.userId !== userId) {
      throw new PdfGenerationError('ACCESS_DENIED', 'You do not have access to this template');
    }

    // 4. Validate using domain template
    validateData(domainTemplate, data);

   const startTime = Date.now();

const debugHtmlBuffer = await this.pdfGeneratorService.generatePreview(
  template,
  data
);
 
const debugHtml = debugHtmlBuffer.toString('utf-8');

this.logger.debug('Generated HTML (first 500 chars)', {
  htmlPreview: debugHtml.substring(0, 500),
});

      const pdfBuffer = await this.pdfGeneratorService.generatePreview(template, data);
      const generationTime = Date.now() - startTime;


      const fileName = `preview-${template.name}-${Date.now()}.pdf`;
 const fileUrl = await this.storageService.uploadPdf(pdfBuffer, {
  filename: fileName,
  folder: 'previews', 
  metadata: { isPreview: 'true' }, 
});



      const expiresInHours = options?.expiresInHours || 24;
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);


      const pdfDocument = await this.pdfDocumentRepository.create({
        templateId,
        fileName,
        fileUrl,
        fileSize: pdfBuffer.length,
        pageCount: this.estimatePageCount(pdfBuffer),
        data,
        variables:  extractVariables(template, data),
        metadata: {
          quality: options?.quality || 'low',
          includeMetadata: options?.includeMetadata ?? false,
          generationTime,
          isPreview: true,
          ...(options?.ipAddress && { ipAddress: options.ipAddress }),
          ...(options?.userAgent && { userAgent: options.userAgent }),
        },
        status: 'GENERATED',
        isPreview: true,
        expiresAt,
        generatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return pdfDocument;

    } catch (error) {
      if (error instanceof PdfTemplateNotFoundError || error instanceof PdfGenerationError) {
        throw error;
      }
      throw new PdfGenerationError('PREVIEW_GENERATION_FAILED', 'Failed to generate preview PDF', error as Error);
    }
  }

 
  private estimatePageCount(pdfBuffer: Buffer): number {

    const bytesPerPage = 30000;  
    return Math.max(1, Math.ceil(pdfBuffer.length / bytesPerPage));
  }
}