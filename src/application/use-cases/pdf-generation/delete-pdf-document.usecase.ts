import { PdfDocumentRepository } from "@application/interfaces/pdf-document-repository.interface.js";
import { IStorageService } from "@application/interfaces/storage-service.js";
 
import { PdfDocument } from "@domain/entities/pdf-document.entity.js";
import { PdfDocumentAccessDeniedError, PdfDocumentNotFoundError, PdfGenerationError } from "@domain/errors/index.js";

 

export class DeletePdfDocumentUseCase {
  constructor(
    private readonly pdfDocumentRepository: PdfDocumentRepository,
    private readonly storageService: IStorageService
  ) {}

  async execute(
    userId: string,
    documentId: string,
    forceDelete: boolean = false
  ): Promise<void> {
    try {

      const document = await this.pdfDocumentRepository.findById(documentId);
      
      if (!document) {
        throw new PdfDocumentNotFoundError(documentId);
      }


      this.validateAccess(document, userId);


      if (document.deletedAt && !forceDelete) {
        throw new PdfGenerationError(
          'ALREADY_DELETED',
          `PDF document ${documentId} is already deleted`
        );
      }


      if (forceDelete) {

        await this.hardDeleteDocument(documentId, document);
      } else {

        await this.softDeleteDocument(documentId);
      }


      await this.logDocumentDeletion(documentId, userId, forceDelete);

    } catch (error) {
      if (
        error instanceof PdfDocumentNotFoundError ||
        error instanceof PdfDocumentAccessDeniedError ||
        error instanceof PdfGenerationError
      ) {
        throw error;
      }
      
      throw new PdfGenerationError(
        'DELETE_FAILED',
        'Failed to delete PDF document',
        error as Error
      );
    }
  }

  private validateAccess(document: PdfDocument, userId: string): void {

    if (document.generatedBy && document.generatedBy !== userId) {
      throw new PdfDocumentAccessDeniedError(document.id);
    }
  }

  private async softDeleteDocument(documentId: string): Promise<void> {

    await this.pdfDocumentRepository.softDelete(documentId);
    

    await this.pdfDocumentRepository.update(documentId, {
      status: 'DELETED',
    });
  }

  private async hardDeleteDocument(documentId: string, document: PdfDocument): Promise<void> {
    try {

      if (document.fileUrl) {
        await this.storageService.deleteFile(document.fileUrl);
      }
    } catch (storageError) {

      console.error('Failed to delete file from storage:', storageError);
    }


    await this.pdfDocumentRepository.delete(documentId);
  }

  private async logDocumentDeletion(
    documentId: string,
    userId: string,
    forceDelete: boolean
  ): Promise<void> {
    const action = forceDelete ? 'HARD_DELETE' : 'SOFT_DELETE';
    

    console.log(`PDF Document ${action}: ${documentId} by user ${userId}`);
  }
}