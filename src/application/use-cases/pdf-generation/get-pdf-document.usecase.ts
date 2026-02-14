import { PdfDocumentRepository, PublicPdfDocument } from "@application/interfaces/pdf-document-repository.interface.js";
import { PdfDocument } from "@domain/entities/pdf-document.entity.js";
import { PdfDocumentAccessDeniedError, PdfDocumentExpiredError, PdfDocumentNotFoundError, PdfGenerationError } from "@domain/errors/index.js";

 
export class GetPdfDocumentUseCase {
  constructor(private readonly pdfDocumentRepository: PdfDocumentRepository) {}

  async execute(
    userId: string,
    documentId: string
  ): Promise<PdfDocument> {
    try {

      const document = await this.pdfDocumentRepository.findByIdWithRelations(documentId);
      
      if (!document) {
        throw new PdfDocumentNotFoundError(documentId);
      }


      if (document.deletedAt) {
        throw new PdfDocumentNotFoundError(documentId);
      }


      this.validateAccess(document, userId);


      if (document.isPreview && document.expiresAt && new Date() > document.expiresAt) {

        await this.pdfDocumentRepository.update(documentId, {
          status: 'EXPIRED',
          updatedAt: new Date(),
        });
        
        throw new PdfDocumentExpiredError(documentId);
      }


      await this.pdfDocumentRepository.update(documentId, {
        accessedAt: new Date(),
        updatedAt: new Date(),
      });

      return document;

    } catch (error) {
      if (
        error instanceof PdfDocumentNotFoundError ||
        error instanceof PdfDocumentAccessDeniedError ||
        error instanceof PdfDocumentExpiredError
      ) {
        throw error;
      }
      
      throw new PdfGenerationError(
        'GET_DOCUMENT_FAILED',
        'Failed to get PDF document',
        error as Error
      );
    }
  }

 async executePublic(documentId: string): Promise<PublicPdfDocument> {
  try {
    const document = await this.pdfDocumentRepository.findById(documentId);

    if (!document || document.deletedAt) {
      throw new PdfDocumentNotFoundError(documentId);
    }

    if (
      document.isPreview &&
      document.expiresAt &&
      new Date() > document.expiresAt
    ) {
      throw new PdfDocumentExpiredError(documentId);
    }

    await this.pdfDocumentRepository.update(documentId, {
      accessedAt: new Date(),
      updatedAt: new Date(),
    });

    return this.sanitizePublicDocument(document);

  } catch (error) {
    if (
      error instanceof PdfDocumentNotFoundError ||
      error instanceof PdfDocumentExpiredError
    ) {
      throw error;
    }

    throw new PdfGenerationError(
      'GET_PUBLIC_DOCUMENT_FAILED',
      'Failed to get public PDF document',
      error as Error
    );
  }
}

 private sanitizePublicDocument(document: PdfDocument): PublicPdfDocument {
  const {
    filePath,
    fileHash,
    generationTime,
    fileSizeBeforeCompression,
    compressionRatio,
    generatedBy,
    ipAddress,
    userAgent,
    referrer,
    deletedAt,
    metadata,
    ...safeDocument
  } = document;

  return {
    ...safeDocument,
    metadata: metadata
      ? (({ ipAddress, userAgent, ...rest }) => rest)(metadata)
      : null,
  };
}
  private validateAccess(document: PdfDocument, userId: string): void {

    if (document.generatedBy && document.generatedBy !== userId) {



      throw new PdfDocumentAccessDeniedError(document.id);
    }
  }






}