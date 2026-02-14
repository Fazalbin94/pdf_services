 
import { DomainError } from './domain-error.js';

 export class PdfGenerationError extends DomainError {
  constructor(
    code: string,
    message: string,
    originalError?: Error
  ) {
    super('PDF_GENERATION', code, message, 400, originalError);

    // Set prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, PdfGenerationError.prototype);
  }
}

export class PdfDocumentNotFoundError extends PdfGenerationError {
  constructor(documentId: string) {
    super('DOCUMENT_NOT_FOUND', `PDF document with ID "${documentId}" not found`);
  }
}

export class PdfDocumentAccessDeniedError extends PdfGenerationError {
  constructor(documentId: string) {
    super('ACCESS_DENIED', `Access denied to PDF document "${documentId}"`);
  }
}

export class PdfDocumentExpiredError extends PdfGenerationError {
  constructor(documentId: string) {
    super('DOCUMENT_EXPIRED', `PDF document "${documentId}" has expired`);
  }
}

export class PdfGenerationValidationError extends PdfGenerationError {
  constructor(
    _code: string,
    validationErrors: string[]
  ) {
    super(
      'VALIDATION_ERROR',
      `PDF generation validation failed: ${validationErrors.join(', ')}`
    );
    this.details = validationErrors;
  }
  
  details: string[];
}

export class PdfGenerationFailedError extends PdfGenerationError {
  constructor(message: string, originalError?: Error) {
    super('GENERATION_FAILED', message, originalError);
  }
}

export class PreviewGenerationError extends PdfGenerationError {
  constructor(message: string, originalError?: Error) {
    super('PREVIEW_GENERATION_FAILED', message, originalError);
  }
}