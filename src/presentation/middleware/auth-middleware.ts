import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ITokenService, TokenPayload } from '../../application/interfaces/token-service.js';
import { InvalidTokenError, ForbiddenError } from '../../domain/errors/domain-error.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export function createAuthMiddleware(tokenService: ITokenService) {
  return async function requireAuth(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new InvalidTokenError('Authorization header missing or invalid');
    }

    const token = authHeader.substring(7);

    try {
      const payload = await tokenService.verifyAccessToken(token);
      request.user = payload;
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      throw new InvalidTokenError('Token verification failed');
    }
  };
}

export function createSuperAdminMiddleware() {
  return async function requireSuperAdmin(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      throw new InvalidTokenError('Authentication required');
    }

    if (request.user.role !== 'SUPERADMIN') {
      throw new ForbiddenError('SUPERADMIN access required');
    }
  };
}
