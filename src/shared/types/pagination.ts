import { JobStats } from "@domain/entities/pdf-generation-job.entity.js";

 export interface PaginatedResult<TItem, TStats = undefined> {
  items: TItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  
  };
    stats?: TStats;
}
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  securityOption?:string;
  expiresIn?: number;
 
}
