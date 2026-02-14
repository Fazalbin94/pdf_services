import { DomainError } from "./index.js";

 
 
 export class PdfTemplateError extends DomainError {
  constructor(
    code: string,
    message: string,
    originalError?: Error
  ) {
    super(
      'PDF_TEMPLATE', 
      code,          
      message,      
      500,             
      originalError 
    );
  }
}


export class PdfTemplateNotFoundError extends PdfTemplateError {
  constructor(templateId: string) {
    super('NOT_FOUND', `PDF template with ID "${templateId}" not found`);
  }
}

export class PdfTemplateAccessDeniedError extends PdfTemplateError {
  constructor(templateId: string) {
    super('ACCESS_DENIED', `Access denied to PDF template "${templateId}"`);
  }
}

export class PdfTemplateValidationError extends PdfTemplateError {
  constructor(
    _code: string,
    validationErrors: string[]
  ) {
    super(
      'VALIDATION_ERROR',
      `PDF template validation failed: ${validationErrors.join(', ')}`
    );
    this.details = validationErrors;
  }
  
  details: string[];
}

export class PdfTemplateDuplicateError extends PdfTemplateError {
  constructor(
    name: string,
    userId: string,
    organizationId?: string | null
  ) {
    const scope = organizationId 
      ? `organization "${organizationId}"` 
      : `user "${userId}"`;
    
    super(
      'DUPLICATE_NAME',
      `A PDF template with name "${name}" already exists for ${scope}`
    );
  }
}


 