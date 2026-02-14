 
import type { PdfDownloadResult } from '../../dto/generate-pdf.dto.js';
import { 
  PdfGenerationError,
  PdfDocumentNotFoundError,
  PdfDocumentAccessDeniedError,
  PdfDocumentExpiredError
} from '../../../domain/errors/index.js';
import { PdfDocumentRepository } from '@application/interfaces/pdf-document-repository.interface.js';
import { IStorageService } from '@application/interfaces/storage-service.js';
import { ILogger } from '@infrastructure/logger/logger.js';
   
export class DownloadPdfDocumentUseCase {
  constructor(
    private readonly pdfDocumentRepository: PdfDocumentRepository,
    private readonly storageService: IStorageService,
    private readonly logger: ILogger  
  ) {}

  async execute(userId: string, documentId: string): Promise<PdfDownloadResult> {
    try {
      this.logger.info('Starting PDF download', {
        userId,
        documentId,
      });

      const document = await this.pdfDocumentRepository.findById(documentId);
      if (!document) {
        this.logger.warn('Document not found', { documentId });
        throw new PdfDocumentNotFoundError(documentId);
      }

      this.logger.debug('Document found', {
        documentId: document.id,
        fileUrl: document.fileUrl,
        isPreview: document.isPreview,
        expiresAt: document.expiresAt,
        generatedBy: document.generatedBy,
      });

      // Check access
      if (document.generatedBy && document.generatedBy !== userId) {
        this.logger.warn('Access denied', {
          documentId,
          documentOwner: document.generatedBy,
          requestingUser: userId,
        });
        throw new PdfDocumentAccessDeniedError(documentId);
      }

      // Check expiration
      if (document.isPreview && document.expiresAt && new Date() > document.expiresAt) {
        this.logger.warn('Document expired', {
          documentId,
          expiresAt: document.expiresAt,
          currentTime: new Date(),
        });
        throw new PdfDocumentExpiredError(documentId);
      }

      // Try to download
      this.logger.info('Attempting to download file', {
        fileUrl: document.fileUrl,
      });

      const fileBuffer = await this.storageService.downloadFile(document.fileUrl);

      this.logger.info('File downloaded successfully', {
        documentId,
        fileSize: fileBuffer.length,
      });

      // Update access count
      await this.pdfDocumentRepository.incrementAccessCount(documentId);

      return {
        fileName: document.fileName,
        fileSize: document.fileSize,
        fileBuffer,
        mimeType: 'application/pdf',
      };

    } catch (error) {
      this.logger.error('PDF download failed', {
        userId,
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      if (
        error instanceof PdfDocumentNotFoundError ||
        error instanceof PdfDocumentAccessDeniedError ||
        error instanceof PdfDocumentExpiredError
      ) {
        throw error;
      }
      throw new PdfGenerationError('DOWNLOAD_FAILED', 'Failed to download PDF document', error as Error);
    }
  }
 
  async executePublic(documentId: string): Promise<PdfDownloadResult> {
    try {

      const document = await this.pdfDocumentRepository.findById(documentId);
      if (!document) {
        throw new PdfDocumentNotFoundError(documentId);
      }


      if (document.isPreview && document.expiresAt && new Date() > document.expiresAt) {
        throw new PdfDocumentExpiredError(documentId);
      }


      const fileBuffer = await this.storageService.downloadFile(document.fileUrl);


      await this.pdfDocumentRepository.incrementAccessCount(documentId);

      return {
        fileName: document.fileName,
        fileSize: document.fileSize,
        fileBuffer,
        mimeType: 'application/pdf',
      };

    } catch (error) {
      if (
        error instanceof PdfDocumentNotFoundError ||
        error instanceof PdfDocumentExpiredError
      ) {
        throw error;
      }
      throw new PdfGenerationError('PUBLIC_DOWNLOAD_FAILED', 'Failed to download public PDF document', error as Error);
    }
  }
}