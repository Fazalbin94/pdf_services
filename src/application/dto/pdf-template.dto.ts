import { PdfTemplate } from "@prisma/client";

 // Core element types
export type ElementType = 
  | 'text' | 'paragraph' | 'heading' 
  | 'table' | 'image' | 'signature'
  | 'barcode' | 'qrCode' | 'line' | 'rectangle'
  | 'checkbox' | 'radio' | 'list' | 'chart';

export interface Position {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface Style extends Record<string, unknown>{
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'lighter' | 'bolder' | number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  border?: string;
  padding?: string | number;
  margin?: string | number;
  opacity?: number;
  rotation?: number;
}

export interface TableColumn extends Record<string, unknown> {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  style?: Style;
}

export interface ChartOptions  extends Record<string, unknown>{
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  data: Array<Record<string, unknown>>;
  labels?: string[];
  colors?: string[];
  legend?: boolean;
  title?: string;
}

export interface BaseElement extends Record<string, unknown> {
  type: ElementType;
  id: string;
  position: Position;
  style?: Style;
  options?: Record<string, unknown>;
}

export interface TextElement extends BaseElement {
  type: 'text' | 'paragraph' | 'heading';
  content: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6; // For headings
}

export interface TableElement extends BaseElement {
  type: 'table';
  columns: TableColumn[];
  data: Array<Record<string, unknown>>;
  header?: boolean;
  footer?: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  alt?: string;
  base64?: string;
  url?: string;
}

export interface SignatureElement extends BaseElement {
  type: 'signature';
  fieldName: string;
  label: string;
  required?: boolean;
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode' | 'qrCode';
  value: string;
  format?: string;
  size?: { width: number; height: number };
}

export interface ChartElement extends BaseElement {
  type: 'chart';
  chartType: ChartOptions['type'];
  data: ChartOptions['data'];
  options?: Omit<ChartOptions, 'type' | 'data'>;
}

export interface FormElement extends BaseElement {
  type: 'checkbox' | 'radio';
  label: string;
  checked?: boolean;
  value?: string;
  groupName?: string;
}

export type TemplateElement = 
  | TextElement 
  | TableElement 
  | ImageElement 
  | SignatureElement 
  | BarcodeElement 
  | ChartElement 
  | FormElement;

export interface PageConfig extends Record<string, unknown> {
  pageNumber: number;
  elements: TemplateElement[];
  background?: {
    type: 'color' | 'image' | 'gradient';
    value: string;
    opacity?: number;
  };
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface PdfTemplateConfig  extends Record<string, unknown>{
  pages: PageConfig[];
  metadata?: {
    author?: string;
    subject?: string;
    keywords?: string[];
    creator?: string;
    producer?: string;
  //  creationDate?: Date;
   creationDate?: string; 
  modificationDate?: Date;
  };
  variables?: Record<string, VariableDefinition>;
  defaultStyles?: {
    font?: string;
    fontSize?: number;
    color?: string;
    lineHeight?: number;
  };
}

export type VariableType = 
  | 'string' | 'number' | 'boolean' 
  | 'date' | 'array' | 'object' 
  | 'image' | 'signature';

export interface VariableDefinition {
  type: VariableType;
  required: boolean;
  defaultValue?: unknown;
  description?: string;
  validation?: VariableValidation;
}

export interface VariableValidation extends Record<string, unknown> {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: string[];
  format?: 'email' | 'phone' | 'url' | 'date' | 'time' | 'datetime';
  custom?: string;
  errorMessage?: string;
}

export interface ValidationRules  extends Record<string, unknown>{
  requiredFields?: string[];
  fieldValidators?: Record<string, FieldValidator>;
  crossFieldValidators?: CrossFieldValidator[];
}

export interface FieldValidator {
  type: 'email' | 'phone' | 'regex' | 'range' | 'enum' | 'custom';
  pattern?: string;
  min?: number;
  max?: number;
  enum?: string[];
  customValidator?: string;
  errorMessage?: string;
}

export interface CrossFieldValidator {
  fields: string[];
  validator: string;
  errorMessage: string;
  condition?: string;
}

export type Variables = Record<string, VariableDefinition>;

export interface FontDefinition  extends Record<string, unknown>{
  family: string;
  src: string;
  weight?: string | number;
  style?: 'normal' | 'italic' | 'oblique';
  format?: string;
}

export interface Styles extends Record<string, unknown> {
  global?: {
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
    color?: string;
    margin?: number;
    padding?: number;
  };
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
}

export type Fonts = FontDefinition[] | Record<string, string>;

export type PageSize = 
  | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' 
  | 'LETTER' | 'LEGAL' | 'TABLOID' | 'CUSTOM';

export type Orientation = 'PORTRAIT' | 'LANDSCAPE';

export type BackgroundType = 
  | 'NONE' | 'COLOR' | 'IMAGE' | 'PDF' | 'LETTERHEAD';

export interface Margins extends Record<string, unknown> {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface HeaderFooterContent extends Record<string, unknown>{
  type: 'text' | 'image' | 'html' | 'template';
  content: string;
  style?: Style;
  height?: number;
  includeOnPages?: 'all' | 'first' | 'last' | number[];
}

export interface CreatePdfTemplateData  extends Record<string, unknown>{
  // Basic Info
  name: string;
  title: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  
  // Template Configuration
  config: PdfTemplateConfig;
  variables?: Variables;
  defaultData?: Record<string, unknown>;
  validationRules?: ValidationRules;
  
  // Layout
  pageSize?: PageSize;
  orientation?: Orientation;
  margins?: Margins;
  fonts?: Fonts;
  styles?: Styles;
  
  // Background
  backgroundType?: BackgroundType;
  backgroundUrl?: string | null;
  backgroundColor?: string | null;
  opacity?: number | null;
  letterheadId?: string | null;
  
  // Header/Footer
  headerContent?: HeaderFooterContent;
  footerContent?: HeaderFooterContent;
  
  // Versioning
  version?: string;
  isActive?: boolean;
  isPublic?: boolean;
  
  // Organization
  organizationId?: string | null;
  
  // System
  isSystem?: boolean;
  thumbnailUrl?: string | null;
  estimatedPages?: number | null;
  
  // Required
  userId: string;
  
  // Timestamps
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface UpdatePdfTemplateData extends Partial<CreatePdfTemplateData> {
  deletedAt?: Date | null;
  publishedAt?: Date | null;
  isPublic?: boolean;
  isActive?: boolean;
}

export interface ClonePdfTemplateData {
  newName: string;
  newTitle?: string;
  description?: string;
  isActive?: boolean;
  isPublic?: boolean;
  organizationId?: string | null;
  userId?: string;
  newDescription?: string;
  newCategory?: string;
}

export interface ListPdfTemplatesFilters {
  category?: string;
  isActive?: boolean | string;
  isPublic?: boolean | string;
  search?: string;
  sortBy?: 'name' | 'title' | 'createdAt' | 'updatedAt' | 'category';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  tags?: string[];
  userId?: string;
  organizationId?: string;
  includeDeleted?: boolean;
  backgroundType?: BackgroundType;
}



export interface TemplateStatsSummary {
  totalTemplates: number;
  activeTemplates: number;
  publicTemplates: number;
  byCategory: Record<string, number>;
  byBackgroundType: Record<BackgroundType, number>;
}

// For flexible data handling
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonValue[] 
  | { [key: string]: JsonValue };

export type SafeAny = JsonValue | Date | Buffer | undefined;

// Type guards
export function isTemplateElement(obj: unknown): obj is TemplateElement {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'id' in obj &&
    'position' in obj
  );
}

export function isVariables(obj: unknown): obj is Variables {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    Object.values(obj).every(val => 
      typeof val === 'object' &&
      val !== null &&
      'type' in val &&
      'required' in val
    )
  );
}

export interface PublicPdfTemplate {
  id: string;

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

  thumbnailUrl: string | null;
  estimatedPages: number | null;

  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  letterheadId: string | null;
}
