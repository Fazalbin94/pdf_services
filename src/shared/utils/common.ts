import { Prisma } from "@prisma/client";
import { SupabaseClient } from "@supabase/supabase-js";
import { Readable } from 'stream';

export function isValidEmail(email: string): boolean { const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; return emailRegex.test(email); }

 
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${formatted} ${sizes[i]}`;
}
 export function isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  
// Helper function for JSON parsing
export function parseJsonField<T>(field: unknown): T | null {
  if (field === null || field === undefined) {
    return null;
  }
  
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch (error) {
      console.error('Failed to parse JSON field:', error);
      return null;
    }
  }
  if (typeof field === 'object') {
      return field as T;
    }

  return field as unknown as T;
}

export function escapeSqlValue(value: string): string {
  return value.replace(/'/g, "''");
}
function isDate(value: unknown): value is Date {
  return value instanceof Date;
}
 export function extractFilterValues(where: Prisma.PdfGenerationJobWhereInput): {
  templateId?: string;
  userId?: string;
  fromDate?: Date;
  toDate?: Date;
} {
  const result: {
    templateId?: string;
    userId?: string;
    fromDate?: Date;
    toDate?: Date;
  } = {};

  // Extract templateId
  if (where.templateId) {
    if (typeof where.templateId === 'string') {
      result.templateId = where.templateId;
    } else if (typeof where.templateId === 'object' && 'equals' in where.templateId) {
      result.templateId = where.templateId.equals as string;
    }
  }

  // Extract userId from template relation
  if (where.template && typeof where.template === 'object') {
    const templateWhere = where.template as Prisma.PdfTemplateWhereInput;
    if (templateWhere.userId) {
      if (typeof templateWhere.userId === 'string') {
        result.userId = templateWhere.userId;
      } else if (typeof templateWhere.userId === 'object' && 'equals' in templateWhere.userId) {
        result.userId = templateWhere.userId.equals as string;
      }
    }
  }

  // Extract date range - handle both Date and DateTimeFilter types
  if (where.createdAt) {
    if (typeof where.createdAt === 'object') {
      // Check if it's a DateTimeFilter (has gte/lte properties)
      const createdAtFilter = where.createdAt as Prisma.DateTimeFilter<"PdfGenerationJob">;
      
      if (createdAtFilter.gte) {
        if (createdAtFilter.gte instanceof Date) {
          result.fromDate = createdAtFilter.gte;
        } else if (typeof createdAtFilter.gte === 'string') {
          result.fromDate = new Date(createdAtFilter.gte);
        }
      }
      
      if (createdAtFilter.lte) {
        if (createdAtFilter.lte instanceof Date) {
          result.toDate = createdAtFilter.lte;
        } else if (typeof createdAtFilter.lte === 'string') {
          result.toDate = new Date(createdAtFilter.lte);
        }
      }
    } else  if (isDate(where.createdAt)) {
  result.fromDate = where.createdAt;
  result.toDate = where.createdAt;
}
  }

  return result;
}

export const parseBoolean = (
  value: unknown,
  defaultValue = false
): boolean => {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const str = value.toLowerCase().trim();
    if (['true', '1', 'yes', 'on'].includes(str)) return true;
    if (['false', '0', 'no', 'off', ''].includes(str)) return false;
    return defaultValue;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return defaultValue;
};

export const parseNumber = (value: any): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};


 

export async function getBufferFromSupabasePath(
  supabase: SupabaseClient,
  bucket: string,
  filePath: string
): Promise<Buffer> {
  console.log("Supabase download - bucket:", bucket, "filePath:", filePath);

  let relativePath = filePath.startsWith(bucket + '/')
    ? filePath.slice(bucket.length + 1)
    : filePath;
  relativePath = relativePath.replace(/\\/g, '/'); // normalize

  console.log("Resolved relativePath:", relativePath);

  const { data, error } = await supabase.storage.from(bucket).download(relativePath);

  if (error || !data) {
    throw new Error(
      `Failed to download file from Supabase. Bucket: ${bucket}, Path: ${relativePath}, Error: ${JSON.stringify(
        error
      )}`
    );
  }

  let buffer: Buffer;

  if (data.arrayBuffer) {
    const arrayBuffer = await data.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else if ((data as any).stream) {
    const chunks: Buffer[] = [];
    for await (const chunk of data as unknown as Readable) {
      chunks.push(Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  } else {
    throw new Error('Unable to convert Supabase file to buffer');
  }

  console.log("Downloaded buffer size:", buffer.length);

  if (!buffer.length) {
    throw new Error(`Downloaded file is empty: ${relativePath}`);
  }

  return buffer;
}


