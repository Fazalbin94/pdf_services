 export interface DatabaseQueryFilter {
  AND?: Array<Record<string, unknown>>;
  OR?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
export interface UserScopeFilter {
  userId: string;
  organizationId?: string | null;
}

 export interface ListLetterheadsQuery {
      category?: string;
      isActive?: string;
      isPublic?: string;
      fileType?: string;
      search?: string;
      page?: string;
      limit?: string;
      sortBy?: string;
      sortOrder?: string;
    }