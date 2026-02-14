import { BackgroundType, FontDefinition,   Fonts,   HeaderFooterContent, Margins, Orientation, PageSize, PdfTemplateConfig, Style, Styles, ValidationRules, Variables } from "@application/dto/pdf-template.dto.js";
import { PaperFormat } from "puppeteer";
export interface HeaderFooterStyles {
  background?: string;
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  height?: number;
  padding?: string | number;
  border?: string;
}
 export interface TemplateStyles extends Record<string, unknown> {
  global?: {
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
    color?: string;
    margin?: number;
    padding?: number;
  };
  header?: HeaderFooterStyles;
  footer?: HeaderFooterStyles;
  headings?: {
    h1?: Style;
    h2?: Style;
    h3?: Style;
    h4?: Style;
    h5?: Style;
    h6?: Style;
  };
  elements?: {
    table?: {
      header?: Style;
      row?: Style;
      cell?: Style;
      border?: string;
      spacing?: number;
    };
    paragraph?: Style;
    list?: Style;
  };
  custom?: Record<string, Style>;
  customCss?: string;
}

 
 export interface PdfTemplate {
  id: string;
  userId: string;
  organizationId: string | null;
  
  name: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  
  config: PdfTemplateConfig;
  variables: Variables | null;
  defaultData: Record<string, unknown> | null;
  validationRules: ValidationRules | null;
  
  pageSize: PageSize;
  orientation: Orientation;
  margins: Margins | null;
  fonts: Fonts | null;
  styles: Styles | null;
  
  backgroundType: BackgroundType;
  backgroundUrl: string | null;
  backgroundColor: string | null;
  opacity: number | null;
  
  headerContent: HeaderFooterContent | null;
  footerContent: HeaderFooterContent | null;
  
  version: string;
  isActive: boolean;
  isPublic: boolean;
  isSystem: boolean;
  
  thumbnailUrl: string | null;
  estimatedPages: number | null;
  
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  deletedAt: Date | null;
  letterheadId: string | null;
}


// Define element types for renderElements
export interface ElementConfig {
  label?: string;
  defaultValue?: string;
  fieldName?: string;
  src?: string;
  alt?: string;
  title?: string;
  description?: string;
  columns?: Array<{ key: string; label: string }>;
  [key: string]: unknown;
}

export interface TemplateElementWithConfig {
  type: string;
  config?: ElementConfig;
  style?: Style;
}
 
export interface PdfMarginOptions {
  top: string | number;
  right: string | number;
  bottom: string | number;
  left: string | number;
}

 

export interface PdfGenerationOptions {
  quality?: 'low' | 'medium' | 'high';
  includeMetadata?: boolean;
 // format?: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid';
  landscape?: boolean;
  
   pageRanges?: string;
 
   format?: PaperFormat | string;
 
  margin?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  } | string;
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  preferCSSPageSize?: boolean;
  timeout?: number;
  scale?: number;
 
}

 
 export interface PdfTemplateForValidation extends  PdfTemplate {
  id: string;
  isActive: boolean;
  isPublic: boolean;
  userId: string;
  organizationId: string | null;

  
 }