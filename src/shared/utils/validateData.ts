// 1. HELPER FUNCTIONS
 
import { CrossFieldValidator, FieldValidator, ValidationRules, VariableDefinition, Variables, VariableType, VariableValidation } from "@application/dto/pdf-template.dto.js";
import { ValidationsError } from "@application/interfaces/validation.js";
import { PdfTemplateForValidation } from "@domain/entities/pdf-template.entity.js";
 
  import { PdfTemplate as PrismaPdfTemplate } from '@prisma/client';
import { PdfTemplate as DomainPdfTemplate } from '../../domain/entities/pdf-template.entity.js';
import { TemplateData, TemplateVariables } from "@application/dto/generate-pdf.dto.js";
import { CreatePdfJobData } from "@application/dto/pdf-job.dto.js";
import { PdfGenerationJobValidationError } from "@domain/errors/pdf-generation-job-error.js";
import { isValidUrl } from "./common.js";
import { CreateLetterheadData } from "@application/dto/letterhead.dto.js";
import { LetterheadValidationError } from "@domain/errors/letterhead-error.js";
 
// Type guard to check if value is a valid record/object
export   const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const areValidVariables = (value: unknown): value is Variables => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(v => 
      typeof v === 'object' &&
      v !== null &&
      'type' in v &&
      typeof (v as any).type === 'string' &&
      'required' in v &&
      typeof (v as any).required === 'boolean'
    )
  );
};

// Helper type guard to check if value is an array of variable definitions
export const isVariableArray = (value: unknown): value is Array<{ name: string; type: string; required: boolean }> => {
  return (
    Array.isArray(value) &&
    value.every(v => 
      typeof v === 'object' &&
      v !== null &&
      'name' in v &&
      typeof v.name === 'string' &&
      'type' in v &&
      typeof v.type === 'string'
    )
  );
};

// Type guard for VariableDefinition
export   const isVariableDefinition = (value: unknown): value is VariableDefinition => {
  return (
    isRecord(value) &&
    'type' in value &&
    typeof value.type === 'string' &&
    'required' in value &&
    typeof value.required === 'boolean'
  );
};

// Type guard for Variables (Record<string, VariableDefinition>)
export   const isVariables = (value: unknown): value is Variables => {
  if (!isRecord(value)) return false;
  
  return Object.values(value).every(isVariableDefinition);
};

 
export const isValidationRules = (value: unknown): value is ValidationRules => {
  if (!isRecord(value)) return false;
  
  // Check structure
  if (
    ('requiredFields' in value && !Array.isArray(value.requiredFields)) ||
    ('fieldValidators' in value && !isRecord(value.fieldValidators)) ||
    ('crossFieldValidators' in value && !Array.isArray(value.crossFieldValidators))
  ) {
    return false;
  }
  
  return true;
};

// Check if value is empty (null, undefined, empty string, empty array, empty object)
export   const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  
  if (typeof value === 'string') return value.trim() === '';
  
  if (Array.isArray(value)) return value.length === 0;
  
  if (isRecord(value)) return Object.keys(value).length === 0;
  
  return false;
};

// Validate a single value against its expected type
export   const validateType = (
  fieldName: string,
  value: unknown,
  expectedType: VariableType,
  validation?: VariableValidation
): void => {
  let isValid = true;
  let errorMessage = '';

  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        isValid = false;
        errorMessage = `Expected string, got ${typeof value}`;
      } else if (validation) {
        const strValue = value as string;
        if (validation.minLength && strValue.length < validation.minLength) {
          isValid = false;
          errorMessage = `Minimum length is ${validation.minLength}, got ${strValue.length}`;
        }
        if (validation.maxLength && strValue.length > validation.maxLength) {
          isValid = false;
          errorMessage = `Maximum length is ${validation.maxLength}, got ${strValue.length}`;
        }
        if (validation.pattern && !new RegExp(validation.pattern).test(strValue)) {
          isValid = false;
          errorMessage = validation.errorMessage || 'Value does not match required pattern';
        }
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        isValid = false;
        errorMessage = `Expected number, got ${typeof value}`;
      } else if (validation) {
        const numValue = value as number;
        if (validation.min && numValue < validation.min) {
          isValid = false;
          errorMessage = `Minimum value is ${validation.min}, got ${numValue}`;
        }
        if (validation.max && numValue > validation.max) {
          isValid = false;
          errorMessage = `Maximum value is ${validation.max}, got ${numValue}`;
        }
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        isValid = false;
        errorMessage = `Expected boolean, got ${typeof value}`;
      }
      break;

    case 'date':
      if (!(value instanceof Date) && 
          !(typeof value === 'string' && !isNaN(Date.parse(value)))) {
        isValid = false;
        errorMessage = `Expected date, got ${typeof value}`;
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        isValid = false;
        errorMessage = `Expected array, got ${typeof value}`;
      }
      break;

    case 'object':
      if (!isRecord(value)) {
        isValid = false;
        errorMessage = `Expected object, got ${typeof value}`;
      }
      break;

    case 'image':
      if (typeof value !== 'string') {
        isValid = false;
        errorMessage = `Expected string (image URL/path), got ${typeof value}`;
      } else if (!value.startsWith('http') && 
                 !value.startsWith('data:image') && 
                 !value.startsWith('/') &&
                 !value.endsWith('.png') && 
                 !value.endsWith('.jpg') && 
                 !value.endsWith('.jpeg') &&
                 !value.endsWith('.gif') && 
                 !value.endsWith('.webp')) {
        isValid = false;
        errorMessage = 'Invalid image format or path';
      }
      break;

    case 'signature':
      if (typeof value !== 'string' && !isRecord(value)) {
        isValid = false;
        errorMessage = `Expected string or object for signature, got ${typeof value}`;
      }
      break;

    default:
      isValid = false;
      errorMessage = `Unknown type: ${expectedType}`;
  }

  if (!isValid) {
    throw new ValidationsError(fieldName, errorMessage, value);
  }
};

// Validate field against field validator
export const validateWithFieldValidator = (
  fieldName: string,
  value: unknown,
  validator: FieldValidator
): void => {
  if (typeof value === 'string') {
    switch (validator.type) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new ValidationsError(
            fieldName,
            validator.errorMessage || 'Invalid email format',
            value
          );
        }
        break;

      case 'phone':
        const cleanPhone = value.replace(/[^0-9+]/g, '');
        if (!/^[\+]?[1-9][\d]{0,15}$/.test(cleanPhone)) {
          throw new ValidationsError(
            fieldName,
            validator.errorMessage || 'Invalid phone number',
            value
          );
        }
        break;

      case 'regex':
        if (!validator.pattern) {
          throw new ValidationsError(fieldName, 'Regex pattern is missing');
        }
        if (!new RegExp(validator.pattern).test(value)) {
          throw new ValidationsError(
            fieldName,
            validator.errorMessage || 'Value does not match required pattern',
            value
          );
        }
        break;
    }
  } else if (typeof value === 'number') {
    switch (validator.type) {
      case 'range':
        if (validator.min !== undefined && value < validator.min) {
          throw new ValidationsError(
            fieldName,
            `Value must be at least ${validator.min}`,
            value
          );
        }
        if (validator.max !== undefined && value > validator.max) {
          throw new ValidationsError(
            fieldName,
            `Value must be at most ${validator.max}`,
            value
          );
        }
        break;

      case 'enum':
        if (!validator.enum || !Array.isArray(validator.enum)) {
          throw new ValidationsError(fieldName, 'Enum validation requires an array of allowed values');
        }
        if (!validator.enum.includes(value.toString())) {
          throw new ValidationsError(
            fieldName,
            validator.errorMessage || `Value must be one of: ${validator.enum.join(', ')}`,
            value
          );
        }
        break;
    }
  }
};

// Parse date from unknown value
const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
};



 
 export function validateAgainstVariables(variables: Variables, data: Record<string, unknown>): void {
  for (const [fieldName, variableDef] of Object.entries(variables)) {
    const value = data[fieldName];
    const isValueEmpty = isEmpty(value);

    // Check required fields
    if (variableDef.required && isValueEmpty) {
      throw new ValidationsError(
        fieldName,
        `Field '${fieldName}' is required but was not provided or is empty`
      );
    }

    // Skip validation if value is empty and field is not required
    if (isValueEmpty && !variableDef.required) {
      continue;
    }

    // Validate type and any additional validation rules
    validateType(
      fieldName,
      value,
      variableDef.type,
      variableDef.validation
    );

    // Validate format if specified
    if (variableDef.validation?.format && typeof value === 'string') {
      validateFormat(fieldName, value, variableDef.validation.format);
    }
  }
}

// 4. VALIDATE AGAINST RULES
  export function validateAgainstRules(rules: ValidationRules, data: Record<string, unknown>): void {
  // Validate required fields
  if (rules.requiredFields) {
    for (const fieldName of rules.requiredFields) {
      if (isEmpty(data[fieldName])) {
        throw new ValidationsError(
          fieldName,
          `Field '${fieldName}' is required by validation rules`
        );
      }
    }
  }

  // Validate field validators
  if (rules.fieldValidators) {
    for (const [fieldName, validator] of Object.entries(rules.fieldValidators)) {
      const value = data[fieldName];
      if (!isEmpty(value)) {
        validateWithFieldValidator(fieldName, value, validator);
      }
    }
  }

  // Validate cross-field validators
  if (rules.crossFieldValidators) {
    for (const crossValidator of rules.crossFieldValidators) {
       validateCrossField(crossValidator, data);
    }
  }
}

// 5. VALIDATE FORMAT
  export function validateFormat(fieldName: string, value: string, format: string): void {
  switch (format) {
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new ValidationsError(fieldName, 'Invalid email format', value);
      }
      break;

    case 'phone':
      const cleanPhone = value.replace(/[^0-9+]/g, '');
      if (!/^[\+]?[1-9][\d]{0,15}$/.test(cleanPhone)) {
        throw new ValidationsError(fieldName, 'Invalid phone number', value);
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch {
        throw new ValidationsError(fieldName, 'Invalid URL', value);
      }
      break;

    case 'date':
    case 'time':
    case 'datetime':
      if (isNaN(Date.parse(value))) {
        throw new ValidationsError(fieldName, `Invalid ${format} format`, value);
      }
      break;

    default:
      // Unknown format - skip validation
      break;
  }
}

// 6. VALIDATE CROSS-FIELD
  export function validateCrossField(crossValidator: CrossFieldValidator, data: Record<string, unknown>): void {
  const fields = crossValidator.fields;
  const validator = crossValidator.validator;

  // Extract values
  const values = fields.map(field => data[field]);

  switch (validator) {
    case 'allOrNone':
      const allPresent = values.every(v => !isEmpty(v));
      const allMissing = values.every(v => isEmpty(v));
      if (!allPresent && !allMissing) {
        throw new ValidationsError(
          fields.join(', '),
          crossValidator.errorMessage || 'All fields must be provided or none at all'
        );
      }
      break;

    case 'dateRange':
      if (fields.length >= 2) {
        const startDate = parseDate(values[0]);
        const endDate = parseDate(values[1]);
        
        if (startDate && endDate && startDate > endDate) {
          throw new ValidationsError(
            fields.join(', '),
            crossValidator.errorMessage || 'Start date must be before or equal to end date'
          );
        }
      }
      break;

    case 'sumEquals':
      const target = crossValidator.condition ? 
        Number(crossValidator.condition) : 0;
      const sum = values.reduce((acc: number, val) => {
        if (typeof val === 'number') return acc + val;
        if (typeof val === 'string') {
          const num = parseFloat(val);
          return isNaN(num) ? acc : acc + num;
        }
        return acc;
      }, 0);
      
      if (Math.abs(sum - target) > 0.001) {
        throw new ValidationsError(
          fields.join(', '),
          crossValidator.errorMessage || `Sum of fields must equal ${target}`
        );
      }
      break;

    default:
      // Unknown validator - skip
      console.warn(`Unknown cross-field validator: ${validator}`);
  }
}

    export function validateData(template: DomainPdfTemplate, data: TemplateData): void {
       
       if (!isRecord(data)) {
         throw new ValidationsError('data', 'Data must be an object');
       }
     
    
       if (template.variables && isVariables(template.variables)) {
          validateAgainstVariables(template.variables, data);
       }
     
     
       if (template.validationRules && isValidationRules(template.validationRules)) {
          validateAgainstRules(template.validationRules, data);
       }
     }
  
   export function extractVariables(
  template: DomainPdfTemplate, 
  data: TemplateData
): TemplateVariables | null {
  try {
    const variables = template.variables;
    
    if (!variables) {
      return null;
    }

    const result: TemplateVariables = {};
    
    // Type guard for Variables
    const areValidVariables = (val: unknown): val is Variables => {
      if (typeof val !== 'object' || val === null) return false;
      
      return Object.values(val).every(v => 
        typeof v === 'object' && 
        v !== null && 
        'type' in v && 
        'required' in v
      );
    };

    if (areValidVariables(variables)) {
      for (const [key, definition] of Object.entries(variables)) {
        const dataValue = data[key];
        
        if (dataValue !== undefined) {
          result[key] = {
            type: definition.type,
            value: dataValue, // This is now acceptable with TemplateVariables['value'] as unknown
            required: definition.required
          };
        }
      }
      return result;
    }
    
    // Handle array format (if needed)
    if (Array.isArray(variables)) {
  for (const variable of variables as unknown as Array<{ name: string; type: VariableType | string; required?: boolean }>) {
        if (typeof variable === 'object' && variable !== null && 'name' in variable) {
          const varObj = variable as { name: string; type: string; required?: boolean };
          const dataValue = data[varObj.name];
          
          if (dataValue !== undefined) {
            result[varObj.name] = {
              type: varObj.type as VariableType,
              value: dataValue,
              required: Boolean(varObj.required)
            };
          }
        }
      }
      return result;
    }
    
    console.warn('Invalid variables format in template:', template.id);
    return null;
    
  } catch (error) {
    console.error('Error extracting variables:', error);
    return null;
  }


}
const allowedSorts = ['createdAt', 'priority', 'status', 'templateId', 'scheduledAt'] as const;
export type AllowedSort = typeof allowedSorts[number];

 
export function isValidSort(sort: string): sort is AllowedSort {
  return allowedSorts.includes(sort as AllowedSort);
}

export function validateCreateData(
  data: CreateLetterheadData | (CreateLetterheadData & { sourceLetterheadId: string })
): void {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Letterhead name is required');
  } else if (data.name.length > 100) {
    errors.push('Letterhead name must be 100 characters or less');
  }

  if (data.description && data.description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }

  if (data.category && data.category.length > 50) {
    errors.push('Category must be 50 characters or less');
  }

  if (data.backgroundColor && !/^#[0-9A-Fa-f]{6}$/.test(data.backgroundColor)) {
    errors.push('Background color must be a valid hex color (e.g., #FF0000)');
  }

  if (data.opacity && (data.opacity < 0 || data.opacity > 1)) {
    errors.push('Opacity must be between 0 and 1');
  }

  // Only validate sourceLetterheadId if present
  if ('sourceLetterheadId' in data && !data.sourceLetterheadId) {
    errors.push('sourceLetterheadId is required for cloning');
  }

  if (errors.length > 0) {
    throw new LetterheadValidationError('INVALID_INPUT', errors);
  }
}