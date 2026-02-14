export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  orgId?: string;
}

export interface ITokenService {
  verifyAccessToken(token: string): Promise<TokenPayload>;
}
