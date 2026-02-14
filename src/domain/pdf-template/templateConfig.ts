 
export interface TemplateElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateElement {
  type: string;
  position: TemplateElementPosition;
  [key: string]: unknown;
}

export interface TemplatePage {
  elements: TemplateElement[];
  [key: string]: unknown;
}

export interface TemplateConfig {
  pages: TemplatePage[];
  [key: string]: unknown;
}
