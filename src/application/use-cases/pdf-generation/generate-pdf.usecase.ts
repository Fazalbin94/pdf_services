 
import type { ExtractedVariables, GeneratePdfData, TemplateData } from '../../dto/generate-pdf.dto.js';
import type { PdfDocument } from '../../../domain/entities/pdf-document.entity.js';
import { IStorageService } from '@application/interfaces/storage-service.js';
import { PdfGeneratorService } from '@infrastructure/services/pdf-generator-service.js';
import { IPdfDocumentRepository } from '@application/interfaces/pdf-document-repository.interface.js';
import { PdfTemplateRepository } from '@application/interfaces/pdf-template-repository.js';
import { PdfGenerationError, PdfTemplateNotFoundError } from '@domain/errors/index.js';
 
import { mapPrismaTemplateToDomain } from '@infrastructure/mappers/pdf-template.mapper.js';
import { extractVariables, validateData } from '@shared/utils/validateData.js';
 

export class GeneratePdfUseCase {
  constructor(
    private readonly pdfTemplateRepository: PdfTemplateRepository,
    private readonly pdfDocumentRepository: IPdfDocumentRepository,
    private readonly pdfGeneratorService: PdfGeneratorService,
    private readonly storageService: IStorageService,
 
  ) {}

 
async execute(
  templateId: string,
  data: TemplateData,
  userId?: string,
  options?: GeneratePdfData['options']
): Promise<PdfDocument> {
  try {
    // 1. Fetch the template
    const template = await this.pdfTemplateRepository.findById(templateId);
    if (!template || !template.isActive) {
      throw new PdfTemplateNotFoundError(templateId);
    }

    // 2. Check access
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


    // 4. Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);  

    let fileName = options?.filename;
    if (!fileName) {
      const templateNameSlug = template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      fileName = `${templateNameSlug}-${timestamp}-${randomString}.pdf`;
    } else {
      const fileExt = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '.pdf';
      const fileNameWithoutExt = fileName.includes('.') ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
      fileName = `${fileNameWithoutExt}-${timestamp}${fileExt}`;
    }

    console.log('Generated unique filename:', fileName);

    // 5. Generate PDF buffer
    const startTime = Date.now();
    const pdfBuffer = await this.pdfGeneratorService.generatePdf(template, data);
    const generationTime = Date.now() - startTime;

    // 6. Upload PDF
    const fileUrl = await this.storageService.uploadPdf(pdfBuffer, {
      filename: fileName,
      folder: 'previews',
      templateId: template.id,
    });

    // 7. Create PDF document record
    const pdfDocument = await this.pdfDocumentRepository.create({
      templateId,
      fileName,
      fileUrl,
      fileSize: pdfBuffer.length,
      pageCount: this.estimatePageCount(pdfBuffer),
      data,
      variables:  extractVariables(template, data),
      metadata: {
        quality: options?.quality || 'medium',
        includeMetadata: options?.includeMetadata ?? true,
        generationTime,
        ...(options?.ipAddress && { ipAddress: options.ipAddress }),
        ...(options?.userAgent && { userAgent: options.userAgent }),
      },
      status: 'GENERATED',
      isPreview: false,
      expiresAt: options?.expiresInHours
        ? new Date(Date.now() + options.expiresInHours * 60 * 60 * 1000)
        : null,
      generatedBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      accessedAt: null,
      deletedAt: null,
    });

    return pdfDocument;

  } catch (error) {
    if (error instanceof PdfTemplateNotFoundError || error instanceof PdfGenerationError) {
      throw error;
    }
    throw new PdfGenerationError(
      'GENERATION_FAILED',
      'Failed to generate PDF',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}


 
  
  private estimatePageCount(pdfBuffer: Buffer): number {
    // Simple estimation - can be improved with PDF parsing
    const bytesPerPage = 50000; // ~50KB per page
    return Math.ceil(pdfBuffer.length / bytesPerPage);
  }
}