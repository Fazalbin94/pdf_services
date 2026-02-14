 export interface PdfTemplateStats {
  id: string;
  templateId: string;
  viewCount: number;
  generationCount: number;
  previewCount: number;
  downloadCount: number;
  lastViewedAt: Date | null;
  lastGeneratedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePdfTemplateStatsData {
  templateId: string;
  viewCount?: number;
  generationCount?: number;
  previewCount?: number;
  downloadCount?: number;
  lastViewedAt?: Date | null;
  lastGeneratedAt?: Date | null;
}

export interface UpdatePdfTemplateStatsData {
  viewCount?: number;
  generationCount?: number;
  previewCount?: number;
  downloadCount?: number;
  lastViewedAt?: Date | null;
  lastGeneratedAt?: Date | null;
  updatedAt?: Date;
}

export interface PdfTemplateStatsRepository {
  findByTemplateId(templateId: string): Promise<PdfTemplateStats | null>;
  
  incrementViewCount(templateId: string): Promise<void>;
  incrementGenerationCount(templateId: string): Promise<void>;
  incrementPreviewCount(templateId: string): Promise<void>;
  incrementDownloadCount(templateId: string): Promise<void>;
  
  update(templateId: string, data: UpdatePdfTemplateStatsData): Promise<PdfTemplateStats>;
  create(data: CreatePdfTemplateStatsData): Promise<PdfTemplateStats>;
  
  // Optional additional methods
  getTopTemplates(limit?: number, period?: 'day' | 'week' | 'month' | 'year'): Promise<Array<{
    templateId: string;
    viewCount: number;
    generationCount: number;
    totalCount: number;
  }>>;
  
  getStatsByPeriod(
    templateId: string, 
    period: 'day' | 'week' | 'month' | 'year'
  ): Promise<Array<{
    date: Date;
    viewCount: number;
    generationCount: number;
    previewCount: number;
    downloadCount: number;
  }>>;
  
  resetStats(templateId: string): Promise<PdfTemplateStats>;
  deleteByTemplateId(templateId: string): Promise<void>;
  exists(templateId: string): Promise<boolean>;
}