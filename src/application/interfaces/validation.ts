 
export interface ValidationData {
  [key: string]: unknown;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
export class ValidationsError extends Error {
  constructor(
    public readonly field: string,
    message: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}