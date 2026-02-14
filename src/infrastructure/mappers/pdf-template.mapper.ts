 
import { PdfTemplate as PrismaPdfTemplate } from '@prisma/client';
import { PdfTemplate as DomainPdfTemplate } from '../../domain/entities/pdf-template.entity.js';
import { PdfTemplateConfig } from '@application/dto/pdf-template.dto.js';
import { parseJsonField } from '@shared/utils/common.js';

 
export function mapPrismaTemplateToDomain(prismaTemplate: any): DomainPdfTemplate {
  return {
    id: prismaTemplate.id,
    userId: prismaTemplate.userId,
    organizationId: prismaTemplate.organizationId,
    name: prismaTemplate.name,
    title: prismaTemplate.title,
    description: prismaTemplate.description,
    category: prismaTemplate.category,
    tags: prismaTemplate.tags || [],
    
    
    config: typeof prismaTemplate.config === 'string' 
      ? JSON.parse(prismaTemplate.config) as PdfTemplateConfig
      : (prismaTemplate.config as PdfTemplateConfig),
    
    
    variables: parseJsonField(prismaTemplate.variables),
    defaultData: parseJsonField(prismaTemplate.defaultData),
    validationRules: parseJsonField(prismaTemplate.validationRules),
    margins: parseJsonField(prismaTemplate.margins),
    fonts: parseJsonField(prismaTemplate.fonts),
    styles: parseJsonField(prismaTemplate.styles),
    headerContent: parseJsonField(prismaTemplate.headerContent),
    footerContent: parseJsonField(prismaTemplate.footerContent),
    
    pageSize: prismaTemplate.pageSize,
    orientation: prismaTemplate.orientation,
    backgroundType: prismaTemplate.backgroundType,
    backgroundUrl: prismaTemplate.backgroundUrl,
    backgroundColor: prismaTemplate.backgroundColor,
    opacity: prismaTemplate.opacity,
    version: prismaTemplate.version,
    isActive: prismaTemplate.isActive,
    isPublic: prismaTemplate.isPublic,
    isSystem: prismaTemplate.isSystem,
    thumbnailUrl: prismaTemplate.thumbnailUrl,
    estimatedPages: prismaTemplate.estimatedPages,
    createdAt: prismaTemplate.createdAt,
    updatedAt: prismaTemplate.updatedAt,
    publishedAt: prismaTemplate.publishedAt,
    deletedAt: prismaTemplate.deletedAt,
    letterheadId: prismaTemplate.letterheadId,
  };
}
