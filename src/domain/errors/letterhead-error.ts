 // src/domain/errors/letterhead-error.ts
import { DomainError } from './domain-error.js';

 export class LetterheadError extends DomainError {
  constructor(
    code: string,
    message: string,
    originalError?: Error
  ) {
    super('LETTERHEAD', code, message, 400, originalError);

    // Set prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, LetterheadError.prototype);
  }
}


export class LetterheadNotFoundError extends LetterheadError {
  constructor(letterheadId: string) {
    super('NOT_FOUND', `Letterhead with ID "${letterheadId}" not found`);
  }
}

export class LetterheadAccessDeniedError extends LetterheadError {
  constructor(letterheadId: string) {
    super('ACCESS_DENIED', `Access denied to letterhead "${letterheadId}"`);
  }
}

export class LetterheadValidationError extends LetterheadError {
  constructor(
    _code: string,
    validationErrors: string[]
  ) {
    super(
      'VALIDATION_ERROR',
      `Letterhead validation failed: ${validationErrors.join(', ')}`
    );
    this.details = validationErrors;
  }
  
  details: string[];
}

export class LetterheadDuplicateError extends LetterheadError {
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
      `A letterhead with name "${name}" already exists for ${scope}`
    );
  }
}