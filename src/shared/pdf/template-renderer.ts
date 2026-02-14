// ==========================================
// Helper Methods
// ==========================================

import { HeaderFooterContent, PageSize, Style } from "@application/dto/pdf-template.dto.js";
import { ElementConfig, PdfGenerationOptions, PdfTemplate, TemplateElementWithConfig, TemplateStyles } from "@domain/entities/pdf-template.entity.js";
import { PaperFormat, PDFOptions } from "puppeteer";
 
export function generateHtmlFromTemplate(
  template: PdfTemplate,
  data: Record<string, unknown>,
  isPreview: boolean = false
): string {
  const templateConfig = template.config || { pages: [] };
  const pageSize = template.pageSize || 'A4';
  const orientation = template.orientation || 'PORTRAIT';
  const margins = template.margins || { top: 72, right: 72, bottom: 72, left: 72 };
  
  // Handle background
  let backgroundStyle = '';
  if (template.backgroundUrl) {
    backgroundStyle = `background-image: url('${template.backgroundUrl}'); background-size: cover; background-repeat: no-repeat;`;
  } else if (template.backgroundColor) {
    backgroundStyle = `background-color: ${template.backgroundColor};`;
  } else {
    backgroundStyle = 'background-color: white;';
  }
  
  // Safely access styles
  const styles = template.styles as TemplateStyles | null;
  const headerStyles = styles?.header || {};
  const footerStyles = styles?.footer || {};
  const customCss = styles?.customCss || '';
  
  // Get elements from first page
  const elements = templateConfig.pages?.[0]?.elements || [];
  const elementsHtml = renderElements(elements, data);
  const headerHtml = template.headerContent ? renderHeader(template.headerContent, data) : '';
  const footerHtml = template.footerContent ? renderFooter(template.footerContent, data) : '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${template.title || 'Generated PDF'}</title>
      <style>
        @page {
          size: ${pageSize} ${orientation.toLowerCase()};
          margin: ${margins.top}pt ${margins.right}pt ${margins.bottom}pt ${margins.left}pt;
        }
        
        body {
          ${backgroundStyle}
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
        }
        
        .container {
          width: 100%;
          min-height: 100vh;
          position: relative;
        }
        
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 72px;
          color: rgba(0, 0, 0, 0.1);
          z-index: 1000;
          pointer-events: none;
        }
        
        .header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: ${margins.top}pt;
          background: ${headerStyles.background || 'transparent'};
          padding: 10pt;
          text-align: ${headerStyles.align || 'center'};
          z-index: 100;
          font-size: ${headerStyles.fontSize || '12'}pt;
          color: ${headerStyles.color || '#333'};
          font-family: ${headerStyles.fontFamily || 'inherit'};
          padding: ${headerStyles.padding || '10pt'};
          ${headerStyles.border ? `border: ${headerStyles.border};` : ''}
        }
        
        .footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: ${margins.bottom}pt;
          background: ${footerStyles.background || 'transparent'};
          padding: 10pt;
          text-align: ${footerStyles.align || 'center'};
          z-index: 100;
          font-size: ${footerStyles.fontSize || '12'}pt;
          color: ${footerStyles.color || '#333'};
          font-family: ${footerStyles.fontFamily || 'inherit'};
          padding: ${footerStyles.padding || '10pt'};
          ${footerStyles.border ? `border: ${footerStyles.border};` : ''}
        }
        
        .content {
          padding: 20pt;
        }
        
        .form-element {
          margin-bottom: 15pt;
        }
        
        .field-label {
          font-weight: bold;
          margin-bottom: 5pt;
          display: block;
        }
        
        .field-value {
          border: 1px solid #ddd;
          padding: 8pt;
          border-radius: 4px;
          background: #f9f9f9;
        }
        
        .table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15pt;
        }
        
        .table th, .table td {
          border: 1px solid #ddd;
          padding: 8pt;
          text-align: left;
        }
        
        .table th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        
        .signature-box {
          border: 1px dashed #999;
          padding: 20pt;
          text-align: center;
          margin: 20pt 0;
          min-height: 80pt;
        }
        
        ${customCss}
      </style>
    </head>
    <body>
      <div class="container">
        ${isPreview ? '<div class="watermark">PREVIEW</div>' : ''}
        ${headerHtml}
        <div class="content">
          ${elementsHtml}
        </div>
        ${footerHtml}
      </div>
    </body>
    </html>
  `;
}

export const getPuppeteerPaperFormat = (pageSize: PageSize): PaperFormat => {
  const formatMap: Record<PageSize, PaperFormat> = {
    'A0': 'a0',
    'A1': 'a1',
    'A2': 'a2',
    'A3': 'a3',
    'A4': 'a4',
    'A5': 'a5',
    'LETTER': 'letter',
    'LEGAL': 'legal',
    'TABLOID': 'tabloid',
    'CUSTOM': 'letter'  
  };
  return formatMap[pageSize] || 'a4';
}

export function renderElements(elements: TemplateElementWithConfig[], data: Record<string, unknown>): string {
  let html = '';
  
  for (const element of elements) {
    const { type, config, style } = element;
    const fieldName = config?.fieldName || '';
    const value = resolveValue(fieldName, data);
    
    switch (type) {
      case 'text':
        html += renderTextElement(config, style, value);
        break;
        
      case 'textarea':
        html += renderTextareaElement(config, style, value);
        break;
        
      case 'table':
        html += renderTableElement(config, data);
        break;
        
      case 'signature':
        html += renderSignatureElement(config, style, value);
        break;
        
      case 'image':
        html += renderImageElement(config, style, value);
        break;
        
      case 'section':
        html += renderSectionElement(config, style);
        break;
        
      default:
        html += renderDefaultElement(type, config, style, value);
    }
  }
  
  return html;
}

export function renderTextElement(
  config: ElementConfig | undefined, 
  style: Style | undefined, 
  value: unknown
): string {
  return `
    <div class="form-element" style="${getStyle(style)}">
      <label class="field-label">${config?.label || ''}</label>
      <div class="field-value">${String(value || config?.defaultValue || '')}</div>
    </div>
  `;
}

export function renderTextareaElement(
  config: ElementConfig | undefined, 
  style: Style | undefined, 
  value: unknown
): string {
  return `
    <div class="form-element" style="${getStyle(style)}">
      <label class="field-label">${config?.label || ''}</label>
      <div class="field-value" style="white-space: pre-wrap;">${String(value || config?.defaultValue || '')}</div>
    </div>
  `;
}

export function renderTableElement(config: ElementConfig | undefined, data: Record<string, unknown>): string {
  if (!config?.columns || !Array.isArray(config.columns)) {
    return '';
  }
  
  // Try to get table data
  let tableData: unknown[] = [];
  if (config.fieldName) {
    const dataValue =  resolveValue(config.fieldName, data);
    if (Array.isArray(dataValue)) {
      tableData = dataValue;
    }
  }
  
  return `
    <table class="table">
      <thead>
        <tr>
          ${config.columns.map(col => `<th>${col.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${tableData.map((row: unknown) => {
          if (typeof row === 'object' && row !== null) {
            const rowObj = row as Record<string, unknown>;
            return `
              <tr>
                ${config!.columns!.map(col => `<td>${String(rowObj[col.key] || '')}</td>`).join('')}
              </tr>
            `;
          }
          return '';
        }).join('')}
      </tbody>
    </table>
  `;
}

export function renderSignatureElement(
  config: ElementConfig | undefined, 
  style: Style | undefined, 
  value: unknown
): string {
  const signatureValue = typeof value === 'string' ? value : '';
  
  return `
    <div class="form-element" style="${ getStyle(style)}">
      <label class="field-label">${config?.label || 'Signature'}</label>
      <div class="signature-box">
        ${signatureValue ? 
          `<img src="${signatureValue}" style="max-width: 200px; max-height: 80px;" alt="Signature" />` : 
          '________________'
        }
      </div>
    </div>
  `;
}

export function renderImageElement(
  config: ElementConfig | undefined, 
  style: Style | undefined, 
  value: unknown
): string {
  const imageSrc = typeof value === 'string' && value ? value : config?.src;
  
  if (!imageSrc) {
    return '';
  }
  
  return `
    <div class="form-element" style="${ getStyle(style)}">
      <img src="${imageSrc}" 
           alt="${config?.alt || ''}" 
           style="max-width: 100%; height: auto;" />
    </div>
  `;
}

export function renderSectionElement(
  config: ElementConfig | undefined, 
  style: Style | undefined
): string {
  return `
    <div class="form-element" style="${ getStyle(style)}">
      <h2 style="border-bottom: 2px solid #333; padding-bottom: 5pt; margin-bottom: 15pt;">
        ${config?.title || ''}
      </h2>
      ${config?.description ? `<p>${config.description}</p>` : ''}
    </div>
  `;
}

export function renderDefaultElement(
  type: string,
  config: ElementConfig | undefined,
  style: Style | undefined,
  value: unknown
): string {
  return `
    <div class="form-element" style="${ getStyle(style)}">
      <label class="field-label">${config?.label || type}</label>
      <div class="field-value">${String(value || '')}</div>
    </div>
  `;
}

export function renderHeader(
  headerConfig: HeaderFooterContent, 
  data: Record<string, unknown>
): string {
  const content = headerConfig.content || '';
  const resolvedContent =  resolveContent(content, data);
  
  return `
    <div class="header">
      ${resolvedContent}
    </div>
  `;
}

export function renderFooter(
  footerConfig: HeaderFooterContent, 
  data: Record<string, unknown>
): string {
  const content = footerConfig.content || '';
  const resolvedContent =  resolveContent(content, data);
  
  return `
    <div class="footer">
      ${resolvedContent}
    </div>
  `;
}

export function resolveValue(fieldName: string, data: Record<string, unknown>): unknown {
  if (!fieldName) return null;
  
  // Handle nested properties (e.g., "user.name")
  return fieldName.split('.').reduce((obj, key) => {
    if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
      return (obj as Record<string, unknown>)[key];
    }
    return null;
  }, data as unknown);
}

export function resolveContent(content: string, data: Record<string, unknown>): string {
  return content.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
    const value =  resolveValue(key, data);
    return value !== null && value !== undefined ? String(value) : match;
  });
}

export function getStyle(style: Style | undefined): string {
  if (!style) return '';
  
  const styleProps: string[] = [];
  
  if (style.width !== undefined) styleProps.push(`width: ${style.width};`);
  if (style.height !== undefined) styleProps.push(`height: ${style.height};`);
  if (style.color) styleProps.push(`color: ${style.color};`);
  if (style.backgroundColor) styleProps.push(`background-color: ${style.backgroundColor};`);
  if (style.fontSize !== undefined) styleProps.push(`font-size: ${style.fontSize};`);
  if (style.fontWeight) styleProps.push(`font-weight: ${style.fontWeight};`);
  if (style.textAlign) styleProps.push(`text-align: ${style.textAlign};`);
  if (style.margin !== undefined) styleProps.push(`margin: ${style.margin};`);
  if (style.padding !== undefined) styleProps.push(`padding: ${style.padding};`);
  if (style.border) styleProps.push(`border: ${style.border};`);
  if (style.opacity !== undefined) styleProps.push(`opacity: ${style.opacity};`);
  if (style.rotation !== undefined) styleProps.push(`transform: rotate(${style.rotation}deg);`);
  if (style.lineHeight !== undefined) styleProps.push(`line-height: ${style.lineHeight};`);
  if (style.fontFamily) styleProps.push(`font-family: ${style.fontFamily};`);
  
  return styleProps.join(' ');
}


// export function getPdfOptions(template: PdfTemplate, options?: PdfGenerationOptions): PdfGenerationOptions {
//   const defaultOptions: PdfGenerationOptions = {
//     format: template.pageSize || 'A4',
//     landscape: template.orientation === 'LANDSCAPE',
//     margin: template.margins ? {
//       top: `${template.margins.top}pt`,
//       right: `${template.margins.right}pt`,
//       bottom: `${template.margins.bottom}pt`,
//       left: `${template.margins.left}pt`
//     } : { top: '72pt', right: '72pt', bottom: '72pt', left: '72pt' },
//     printBackground: true,
//     displayHeaderFooter: !!(template.headerContent || template.footerContent),
//     headerTemplate: template.headerContent 
//       ? `<div style="font-size: 10pt; text-align: center; width: 100%;">${template.headerContent.content || ''}</div>`
//       : '',
//     footerTemplate: template.footerContent
//       ? `<div style="font-size: 10pt; text-align: center; width: 100%;">${template.footerContent.content || ''}</div>`
//       : '',
//     preferCSSPageSize: true,
//     timeout: 30000,
//   };
  
//   return { ...defaultOptions, ...options };
// }





// export function getPdfOptionsFromOptions(options?: PdfGenerationOptions): PdfGenerationOptions {
//   const defaultOptions: PdfGenerationOptions = {
//     format: 'A4',
//     landscape: false,
//     margin: { top: '72pt', right: '72pt', bottom: '72pt', left: '72pt' },
//     printBackground: true,
//     displayHeaderFooter: false,
//     preferCSSPageSize: true,
//     timeout: 30000,
//   };
  
//   return { ...defaultOptions, ...options };
// }

 
 