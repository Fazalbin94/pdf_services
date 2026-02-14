import { DomainError } from "./index.js";

 
export class PdfGenerationJobError extends DomainError {
  constructor(
    code: string,
    message: string,
    originalError?: Error
  ) {
    super('PDF_GENERATION_JOB', code, message, 400, originalError);

   
    Object.setPrototypeOf(this, PdfGenerationJobError.prototype);
  }
}


export class PdfGenerationJobNotFoundError extends PdfGenerationJobError {
  constructor(jobId: string) {
    super('NOT_FOUND', `PDF generation job with ID "${jobId}" not found`);
  }
}

export class PdfGenerationJobAccessDeniedError extends PdfGenerationJobError {
  constructor(jobId: string) {
    super('ACCESS_DENIED', `Access denied to PDF generation job "${jobId}"`);
  }
}

export class PdfGenerationJobValidationError extends PdfGenerationJobError {
  constructor(
    _code: string,
    validationErrors: string[]
  ) {
    super(
      'VALIDATION_ERROR',
      `PDF generation job validation failed: ${validationErrors.join(', ')}`
    );
    this.details = validationErrors;
  }
  
  details: string[];
}

export class PdfTemplateNotFoundError extends PdfGenerationJobError {
  constructor(templateId: string) {
    super('TEMPLATE_NOT_FOUND', `PDF template with ID "${templateId}" not found`);
  }
}

export class PdfGenerationJobQueueError extends PdfGenerationJobError {
  constructor(message: string, originalError?: Error) {
    super('QUEUE_ERROR', message, originalError);
  }
}

export class PdfGenerationJobTimeoutError extends PdfGenerationJobError {
  constructor(jobId: string) {
    super('TIMEOUT', `PDF generation job "${jobId}" timed out`);
  }
}

export class PdfGenerationJobMaxAttemptsError extends PdfGenerationJobError {
  constructor(jobId: string, maxAttempts: number) {
    super('MAX_ATTEMPTS', `PDF generation job "${jobId}" reached maximum attempts (${maxAttempts})`);
  }
}