 
// src/domain/errors/index.ts
export { DomainError } from './domain-error.js';
export { LetterheadError } from './letterhead-error.js';

export { PdfGenerationError } from './pdf-generation-error.js';
export { PdfGenerationJobError } from './pdf-generation-job-error.js';
export { PdfTemplateError, PdfTemplateNotFoundError } from './pdf-template-error.js';
export { StorageError } from './storage-error.js';
export {PdfDocumentNotFoundError,PdfDocumentAccessDeniedError,PdfDocumentExpiredError} from './pdf-generation-error.js'