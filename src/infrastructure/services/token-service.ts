import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  ITokenService,
  TokenPayload,
} from '../../application/interfaces/token-service.js';
import { InvalidTokenError } from '../../domain/errors/domain-error.js';

export class SupabaseTokenService implements ITokenService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const { data, error } = await this.supabase.auth.getUser(token);

      if (error || !data.user) {
        throw new InvalidTokenError('Invalid token');
      }

      const user = data.user;
      const metadata = user.user_metadata || {};

      return {
        sub: user.id,
        email: user.email || '',
        role: metadata.role || 'USER',
        permissions: this.getPermissionsForRole(metadata.role || 'USER'),
        orgId: metadata.orgId,
      };
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      throw new InvalidTokenError('Token verification failed');
    }
  }

  private getPermissionsForRole(role: string): string[] {
    const permissions: Record<string, string[]> = {
      ADMIN: [
        'forms:read', 'forms:write', 'forms:delete',
        'submissions:read', 'submissions:write', 'submissions:delete',
      ],
      MANAGER: [
        'forms:read', 'forms:write',
        'submissions:read', 'submissions:write',
      ],
      USER: ['forms:read', 'submissions:read', 'submissions:write'],
    };
    return permissions[role] || [];
  }
}
