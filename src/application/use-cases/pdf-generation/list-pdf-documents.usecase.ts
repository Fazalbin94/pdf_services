import { ListPdfDocumentsFilters, TemplateData, TransformedDocument } from "@application/dto/generate-pdf.dto.js";
 import { DocumentStats, DocumentStatsFilters, PdfDocumentFilters, PdfDocumentRepository } from "@application/interfaces/pdf-document-repository.interface.js";
import { PdfDocument    } from "@domain/entities/pdf-document.entity.js";
import { PdfGenerationError } from "@domain/errors/index.js";
import { DocumentStatus, Prisma } from "@prisma/client";
import { PaginatedResult } from "@shared/types/pagination.js";
import { formatFileSize } from "@shared/utils/common.js";

 
 
export class ListPdfDocumentsUseCase {
  constructor(private readonly pdfDocumentRepository: PdfDocumentRepository) {}

  async execute(
    userId: string,
    filters: ListPdfDocumentsFilters = {}
  ): Promise<PaginatedResult<TransformedDocument>> {
    try {

      const normalizedFilters = this.normalizeFilters(filters);


      const queryFilters = this.buildQueryFilters(userId, normalizedFilters);


      const result = await this.pdfDocumentRepository.findAll(
        queryFilters,
        {
          page: normalizedFilters.page,
          limit: normalizedFilters.limit,
          sortBy: normalizedFilters.sortBy,
          sortOrder: normalizedFilters.sortOrder,
        }
      );


      const transformedItems = this.transformResults(result.items);

      const totalPages = Math.ceil(result.total / normalizedFilters.limit);
      const hasNext = normalizedFilters.page < totalPages;
      const hasPrevious = normalizedFilters.page > 1;

      return {
        items: transformedItems,
        pagination: {
          page: normalizedFilters.page,
          limit: normalizedFilters.limit,
          total: result.total,
          totalPages,
          hasNext,
          hasPrevious,
        },
      };

    } catch (error) {
      if (error instanceof PdfGenerationError) {
        throw error;
      }
      
      throw new PdfGenerationError(
        'LIST_DOCUMENTS_FAILED',
        'Failed to list PDF documents',
        error as Error
      );
    }
  }

 // Update the filters parameter type
async executeStats(
  userId: string,
  filters?: { period?: DocumentStatsFilters['period']; templateId?: string; fromDate?: Date; toDate?: Date; }
): Promise<DocumentStats> {
  try {
    // Convert the filters to proper DocumentStatsFilters
    const statsFilters: DocumentStatsFilters = {
      period: filters?.period as DocumentStatsFilters['period'] | undefined,
      templateId: filters?.templateId,
      fromDate: filters?.fromDate,
      toDate: filters?.toDate,
      userId,
    };
    
    return await this.pdfDocumentRepository.getStats(userId, statsFilters);
  } catch (error) {
    throw new PdfGenerationError(
      'GET_STATS_FAILED',
      'Failed to get document statistics',
      error as Error
    );
  }
}

 // Update normalizeFilters to properly convert status
private normalizeFilters(filters: ListPdfDocumentsFilters): {
  templateId?: string;
  status?: DocumentStatus; // Change to DocumentStatus
  isPreview?: boolean;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
} {
  // Convert status string to DocumentStatus
  const validStatuses: DocumentStatus[] = [
    'PENDING', 'GENERATING', 'GENERATED', 'FAILED', 'EXPIRED', 'DELETED'
  ];
  
  const status = filters.status && validStatuses.includes(filters.status as DocumentStatus)
    ? filters.status as DocumentStatus
    : undefined;

  return {
    templateId: filters.templateId,
    status: status,
    isPreview: filters.isPreview === 'true' ? true : 
              filters.isPreview === 'false' ? false : undefined,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    search: filters.search,
    page: filters.page || 1,
    limit: Math.min(filters.limit || 20, 100),
    sortBy: filters.sortBy || 'createdAt',
    sortOrder: filters.sortOrder || 'desc',
  };
}
 
 private buildQueryFilters(
  userId: string,
  filters: ReturnType<typeof this.normalizeFilters>
): PdfDocumentFilters {
  const queryFilters: PdfDocumentFilters = {
    generatedBy: userId,
    excludeDeleted: true,
  };

  if (filters.templateId) {
    queryFilters.templateId = filters.templateId;
  }

  if (filters.status) {
    queryFilters.status = filters.status as DocumentStatus;
  }

  if (filters.isPreview !== undefined) {
    queryFilters.isPreview = filters.isPreview;
  }

  if (filters.fromDate) {
    queryFilters.fromDate = filters.fromDate;
  }

  if (filters.toDate) {
    queryFilters.toDate = filters.toDate;
  }

  if (filters.search) {
    queryFilters.search = filters.search;
    // You might want to search in multiple fields
  }

  return queryFilters;
}


 private transformResults(documents: PdfDocument[]): TransformedDocument[] {
  return documents.map(document => {
    const fileSizeFormatted =  formatFileSize(document.fileSize);
    
    const ageInDays = Math.floor(
      (new Date().getTime() - new Date(document.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    let expiresInHours: number | undefined;
    if (document.isPreview && document.expiresAt) {
      expiresInHours = Math.max(0, Math.floor(
        (new Date(document.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60)
      ));
    }

    // Ensure data is TemplateData type
    const templateData: TemplateData = typeof document.data === 'string' 
      ? JSON.parse(document.data) 
      : document.data as TemplateData;

    // Ensure status is DocumentStatus
    const status = document.status as DocumentStatus;

    // Spread the original document to include all fields expected by TransformedDocument
    return {
      ...document,
      data: templateData,
      status,
      fileSizeFormatted,
      ageInDays,
      expiresInHours
    } as TransformedDocument;
  });
}

 

}