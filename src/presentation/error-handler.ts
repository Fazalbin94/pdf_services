import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from '../domain/errors/domain-error.js';
import { LetterheadError } from '@domain/errors/index.js';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  request.log.error(error);

  // Fastify Validation Error
  if (error.validation) {
    const response: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.validation,
      },
    };
    reply.status(400).send(response);
    return;
  }

  // Zod Validation Error
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    };
    reply.status(400).send(response);
    return;
  }

  // Domain Error
  if (error instanceof DomainError) {
    const response: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
      },
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  // Rate Limit Error
  if (error.statusCode === 429) {
    const response: ErrorResponse = {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    };
    reply.status(429).send(response);
    return;
  }

  // Default Server Error
  const response: ErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'An unexpected error occurred',
    },
  };
  reply.status(500).send(response);
}
export function getStatusCodeForError(error: LetterheadError): number {
  switch (error.code) {
    case 'NOT_FOUND':
      return 404;
    case 'DUPLICATE_ERROR':
      return 409;
    case 'VALIDATION_ERROR':
      return 400;
    default:
      return 500;
  }
}