 
import type { FastifyRequest, FastifyReply } from 'fastify';
 
 
export type PreHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;

 
export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: string;
  orgId: string | null;
}

