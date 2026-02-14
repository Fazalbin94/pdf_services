 // src/domain/errors/domain-error.ts

export class DomainError extends Error {
  constructor(
    public readonly domain: string,
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/* ------------------------------------------------------------------ */
/* FORM ERRORS */
/* ------------------------------------------------------------------ */

export class FormDefinitionNotFoundError extends DomainError {
  constructor(id: string) {
    super(
      'FORM',
      'FORM_DEFINITION_NOT_FOUND',
      `Formular mit ID "${id}" wurde nicht gefunden`,
      404
    );
  }
}

export class FormDefinitionAlreadyExistsError extends DomainError {
  constructor(name: string) {
    super(
      'FORM',
      'FORM_DEFINITION_ALREADY_EXISTS',
      `Formular mit dem Namen "${name}" existiert bereits`,
      409
    );
  }
}

export class FormSubmissionNotFoundError extends DomainError {
  constructor(id: string) {
    super(
      'FORM',
      'FORM_SUBMISSION_NOT_FOUND',
      `Formular-Einreichung mit ID "${id}" wurde nicht gefunden`,
      404
    );
  }
}

export class FormValidationError extends DomainError {
  constructor(
    message: string,
    public readonly errors: Array<{ fieldName: string; message: string }>
  ) {
    super(
      'FORM',
      'FORM_VALIDATION_FAILED',
      message,
      400
    );
  }
}

/* ------------------------------------------------------------------ */
/* AUTH ERRORS */
/* ------------------------------------------------------------------ */

export class InvalidTokenError extends DomainError {
  constructor(message: string = 'Invalid or expired token') {
    super(
      'AUTH',
      'INVALID_TOKEN',
      message,
      401
    );
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized') {
    super(
      'AUTH',
      'UNAUTHORIZED',
      message,
      401
    );
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = 'Forbidden') {
    super(
      'AUTH',
      'FORBIDDEN',
      message,
      403
    );
  }
}

/* ------------------------------------------------------------------ */
/* PDF TEMPLATE ERRORS */
/* ------------------------------------------------------------------ */

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
    super(
      'NOT_FOUND',
      `PDF template with ID "${templateId}" not found`
    );
  }
}

export class PdfTemplateAccessDeniedError extends PdfTemplateError {
  constructor(templateId: string) {
    super(
      'ACCESS_DENIED',
      `Access denied to PDF template "${templateId}"`
    );
  }
}
