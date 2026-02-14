 
import puppeteer, { Browser, Page } from 'puppeteer';
import type { PdfTemplate } from '../../domain/entities/pdf-template.entity.js';
import { PdfGenerationError } from '../../domain/errors/pdf-generation-error.js';
import { generateHtmlFromTemplate } from '@shared/pdf/template-renderer.js';

export interface PdfGenerationOptions {
  quality?: 'low' | 'medium' | 'high';
  includeMetadata?: boolean;
  format?: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid';
  landscape?: boolean;
  margin?: { top: string; right: string; bottom: string; left: string };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
  scale?: number;
  pageRanges?: string;
  preferCSSPageSize?: boolean;
  timeout?: number;
}

export class PdfGeneratorService {
  private browser: Browser | null = null;

  constructor(
    private readonly options: {
      puppeteerExecutablePath?: string;
      headless?: boolean;
      args?: string[];
    } = {}
  ) {}

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: this.options.headless ?? true,
        executablePath: this.options.puppeteerExecutablePath,
        args: this.options.args || [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
      });
    }
  }

  async generatePdf(
    template: PdfTemplate,
    data: Record<string, any>,
    options?: PdfGenerationOptions
  ): Promise<Buffer> {
    await this.initialize();
    
    let page: Page | null = null;
    
    try {
      page = await this.browser!.newPage();
      
     //  const html = this.generateHtmlFromTemplate(template, data, false);
        const html = this.generateHtmlFromConfig(template, data, false);
      
      console.log('=== GENERATED HTML FOR PDF ===');
      console.log('Template config:', JSON.stringify(template.config, null, 2));
      console.log('Generated HTML (first 1000 chars):', html.substring(0, 1000));
       await page.setContent(html, {
        waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        timeout: options?.timeout || 30000,
      });
      
       const pdfOptions = this.getPdfOptions(template, options);
      
       const pdfBuffer = await page.pdf(pdfOptions);
      
     return Buffer.from(pdfBuffer);
      
    } catch (error) {
         console.error('=== PDF GENERATION FAILED ===');
      console.error('Error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : undefined);
      
      
      if (error instanceof Error) {
        if (error.message.includes('Navigation timeout')) {
          throw new PdfGenerationError(
            'TIMEOUT',
            'PDF generation timed out',
            error
          );
        } else if (error.message.includes('Protocol error')) {
          throw new PdfGenerationError(
            'BROWSER_ERROR',
            'Browser protocol error',
            error
          );
        }
      }
      
      throw new PdfGenerationError(
        'GENERATION_FAILED',
        'Failed to generate PDF',
        error as Error
      );
      
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async generatePreview(
    template: PdfTemplate,
    data: Record<string, any>,
    options?: PdfGenerationOptions
  ): Promise<Buffer> {
    await this.initialize();
    
    let page: Page | null = null;
    
    try {
      page = await this.browser!.newPage();
      
      // Generate proper HTML from template config
      const html = this.generateHtmlFromConfig(template, data, true);
      
      // Log HTML for debugging
      console.log('=== GENERATED HTML FOR PREVIEW ===');
      console.log('Template config:', JSON.stringify(template.config, null, 2));
      console.log('Generated HTML (first 1000 chars):', html.substring(0, 1000));
      
      await page.setContent(html, {
        waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        timeout: options?.timeout || 30000,
      });
      
      // Generate PDF
      const pdfOptions = {
        ...this.getPdfOptions(template, options),
        format: 'A4',
        printBackground: true,
        scale: 0.8,
      };
      
      const pdfBuffer = await page.pdf(pdfOptions);
      
      return Buffer.from(pdfBuffer);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new PdfGenerationError(
        'PREVIEW_GENERATION_FAILED',
        'Failed to generate preview PDF',
        error as Error
      );
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  // NEW METHOD: Generate HTML from template config
  private generateHtmlFromConfig(
  template: PdfTemplate,
  data: Record<string, any>,
  isPreview: boolean = false
): string {
  const config = template.config as any;
  
  console.log('=== DEBUG: Template Config ===');
  console.log('Config structure:', JSON.stringify(config, null, 2));
  console.log('Has pages?', !!config?.pages);
  console.log('Has elements?', !!config?.elements);
  console.log('Has pages[0].elements?', !!(config?.pages?.[0]?.elements));
  
  // Check for different config structures
  let elements = [];
  
  if (config?.pages?.[0]?.elements) {
    // Structure 1: { pages: [{ elements: [...] }] }
    elements = config.pages[0].elements;
  } else if (config?.elements) {
    // Structure 2: { elements: [...] } (from seed)
    elements = config.elements;
  } else if (config) {
    // Structure 3: config is the elements array directly
    elements = Array.isArray(config) ? config : [];
  }
  
  console.log('Extracted elements:', elements.length);
  
  if (elements.length === 0) {
    console.log('No elements found, using default HTML');
    return this.generateDefaultHtml(template, data, isPreview);
  }
  
  // Generate proper HTML with the elements
  const pageSize = template.pageSize || 'A4';
  const orientation = template.orientation === 'LANDSCAPE' ? 'landscape' : 'portrait';
  const margins = template.margins as any || { top: 72, right: 72, bottom: 72, left: 72 };
  
  const elementsHtml = this.renderInvoiceElements(elements, data);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${template.title || 'Invoice'}</title>
      <style>
        @page {
          size: ${pageSize} ${orientation};
          margin: ${margins.top}pt ${margins.right}pt ${margins.bottom}pt ${margins.left}pt;
        }
        
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
        }
        
        .invoice-container {
          padding: 40pt;
        }
        
        .company-header {
          font-size: 24pt;
          font-weight: bold;
          color: #333;
          margin-bottom: 10pt;
        }
        
        .invoice-title {
          font-size: 18pt;
          color: #666;
          margin-bottom: 5pt;
        }
        
        .invoice-date {
          font-size: 12pt;
          color: #999;
          margin-bottom: 30pt;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20pt 0;
        }
        
        .items-table th {
          background-color: #f5f5f5;
          padding: 10pt;
          text-align: left;
          font-weight: bold;
          border-bottom: 2px solid #ddd;
        }
        
        .items-table td {
          padding: 10pt;
          border-bottom: 1px solid #eee;
        }
        
        .total-row {
          font-weight: bold;
          background-color: #f9f9f9;
        }
        
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 72px;
          color: rgba(0,0,0,0.1);
          z-index: -1;
          pointer-events: none;
        }
        
        .signature-area {
          margin-top: 50pt;
          padding-top: 20pt;
          border-top: 1px solid #ddd;
        }
        
        .signature-line {
          width: 200pt;
          border-top: 1px solid #333;
          margin: 20pt 0;
        }
      </style>
    </head>
    <body>
      ${isPreview ? '<div class="watermark">PREVIEW</div>' : ''}
      
      <div class="invoice-container">
        ${elementsHtml}
      </div>
    </body>
    </html>
  `;
}

private renderInvoiceElements(elements: any[], data: Record<string, any>): string {
  let html = '';
  
  for (const element of elements) {
    const { type, content, style, columns, dataField } = element;
    
    // Replace variables in content
    const renderedContent = this.replaceVariables(content || '', data);
    
    switch (type) {
      case 'header':
        html += `
          <div class="company-header" style="${this.parseStyle(style)}">
            ${renderedContent}
          </div>
        `;
        break;
        
      case 'text':
        html += `
          <div class="text-element" style="${this.parseStyle(style)}">
            ${renderedContent}
          </div>
        `;
        break;
        
      case 'table':
        html += this.renderInvoiceTable(columns, data[dataField] || data.items || []);
        break;
        
      case 'section':
        html += `
          <div class="section">
            <h2>${element.title || ''}</h2>
            <p>${this.replaceVariables(element.content || '', data)}</p>
          </div>
        `;
        break;
        
      default:
        html += `<div>${renderedContent}</div>`;
    }
  }
  
  // Add total calculation if we have items
  if (data.items && Array.isArray(data.items)) {
    const total = data.items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    html += `
      <div style="text-align: right; margin-top: 20pt; font-weight: bold;">
        Total: $${total.toFixed(2)}
      </div>
    `;
  }
  
  return html;
}

private renderInvoiceTable(columns: any[], items: any[]): string {
  if (!columns || !items || items.length === 0) {
    return '<p>No items to display</p>';
  }
  
  let html = '<table class="items-table">';
  
  // Header
  html += '<thead><tr>';
  for (const column of columns) {
    html += `<th>${column.label || column.key || ''}</th>`;
  }
  html += '</tr></thead>';
  
  // Body
  html += '<tbody>';
  for (const item of items) {
    html += '<tr>';
    for (const column of columns) {
      const value = item[column.key] || '';
      html += `<td>${value}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  
  return html;
}

  // Helper to render elements from config
  private renderConfigElements(elements: any[], data: Record<string, any>): string {
    let html = '';
    
    for (const element of elements) {
      const { type, position, content, style, ...rest } = element;
      
      // Replace variables in content
      const renderedContent = this.replaceVariables(content || '', data);
      
      switch (type) {
        case 'header':
          html += `
            <div class="element header-element" style="${this.parseStyle(style)}">
              ${renderedContent}
            </div>
          `;
          break;
          
        case 'text':
          html += `
            <div class="element text-element" style="${this.parseStyle(style)}">
              ${renderedContent}
            </div>
          `;
          break;
          
        case 'table':
          html += this.renderTable(rest, data);
          break;
          
        case 'section':
          html += `
            <div class="element" style="${this.parseStyle(style)}">
              <h2>${rest.title || ''}</h2>
              <p>${this.replaceVariables(rest.content || '', data)}</p>
            </div>
          `;
          break;
          
        case 'signature':
          html += `
            <div class="element">
              <div class="signature-box">
                <div style="margin-bottom: 10pt;">${rest.label || 'Signature'}</div>
                ${data[rest.fieldName] 
                  ? `<img src="${data[rest.fieldName]}" style="max-width: 200px; max-height: 80px;" />` 
                  : '________________'
                }
              </div>
            </div>
          `;
          break;
          
        default:
          html += `
            <div class="element">
              ${renderedContent}
            </div>
          `;
      }
    }
    
    return html;
  }

  // Render table from config
  private renderTable(config: any, data: Record<string, any>): string {
    const { columns, dataField } = config;
    const tableData = data[dataField] || [];
    
    let html = '<table class="table">';
    
    // Header
    html += '<thead><tr>';
    for (const column of columns || []) {
      html += `<th>${column.label || ''}</th>`;
    }
    html += '</tr></thead>';
    
    // Body
    html += '<tbody>';
    for (const row of tableData) {
      html += '<tr>';
      for (const column of columns || []) {
        const value = row[column.key] || '';
        html += `<td>${value}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    
    return html;
  }

  // Replace {{variables}} in content
  private replaceVariables(content: string, data: Record<string, any>): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  // Parse style object to CSS string
  private parseStyle(style: any): string {
    if (!style) return '';
    
    const styleProps = [];
    if (style.fontSize) styleProps.push(`font-size: ${style.fontSize}pt`);
    if (style.fontWeight) styleProps.push(`font-weight: ${style.fontWeight}`);
    if (style.color) styleProps.push(`color: ${style.color}`);
    if (style.textAlign) styleProps.push(`text-align: ${style.textAlign}`);
    if (style.margin) styleProps.push(`margin: ${style.margin}pt`);
    if (style.padding) styleProps.push(`padding: ${style.padding}pt`);
    
    return styleProps.join('; ');
  }

  // Get background style from template
  private getBackgroundStyle(template: PdfTemplate): string {
    switch (template.backgroundType) {
      case 'COLOR':
        return `background-color: ${template.backgroundColor || '#FFFFFF'};`;
      case 'IMAGE':
      case 'PDF':
      case 'LETTERHEAD':
        return template.backgroundUrl 
          ? `background-image: url('${template.backgroundUrl}'); background-size: cover; background-repeat: no-repeat; opacity: ${template.opacity || 1};`
          : '';
      default:
        return 'background-color: #FFFFFF;';
    }
  }

  // Render header/footer
  private renderHeaderFooter(content: any, data: Record<string, any>, type: 'header' | 'footer'): string {
    if (!content) return '';
    
    const htmlContent = typeof content === 'string' 
      ? this.replaceVariables(content, data)
      : this.replaceVariables(content.content || '', data);
    
    return `<div class="${type}">${htmlContent}</div>`;
  }

  // Fallback default HTML
  private generateDefaultHtml(template: PdfTemplate, data: Record<string, any>, isPreview: boolean): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${template.title || 'PDF Preview'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40pt;
            padding: 0;
          }
          h1 { color: #333; }
          .watermark { 
            position: fixed; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%) rotate(-45deg); 
            font-size: 72px; 
            color: rgba(0,0,0,0.1); 
            z-index: -1; 
          }
        </style>
      </head>
      <body>
        ${isPreview ? '<div class="watermark">PREVIEW</div>' : ''}
        <h1>${template.title || 'PDF Document'}</h1>
        <p>Template: ${template.name}</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <hr>
        <h2>Data:</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body>
      </html>
    `;
  }

  async generatePdfFromHtml(
    html: string,
    options?: PdfGenerationOptions
  ): Promise<Buffer> {
    await this.initialize();
    
    let page: Page | null = null;
    
    try {
      page = await this.browser!.newPage();
      
      await page.setContent(html, {
        waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        timeout: options?.timeout || 30000,
      });
      
      const pdfOptions = this.getPdfOptionsFromOptions(options);
      const pdfBuffer = await page.pdf(pdfOptions);
      
    return Buffer.from(pdfBuffer);
      
    } catch (error) {
      throw new PdfGenerationError(
        'HTML_TO_PDF_FAILED',
        'Failed to generate PDF from HTML',
        error as Error
      );
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async takeScreenshot(
    template: PdfTemplate,
    data: Record<string, any>,
    options?: {
      type?: 'png' | 'jpeg';
      quality?: number;
      fullPage?: boolean;
      clip?: { x: number; y: number; width: number; height: number };
    }
  ): Promise<Buffer> {
    await this.initialize();
    
    let page: Page | null = null;
    
    try {
      page = await this.browser!.newPage();
      
      const html =  generateHtmlFromTemplate(template, data, false);
      await page.setContent(html, {
        waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        timeout: 30000,
      });
      
      const screenshotOptions = {
        type: options?.type || 'png',
        quality: options?.quality || 80,
        fullPage: options?.fullPage || true,
        ...(options?.clip && { clip: options.clip }),
      };
      
      const screenshotBuffer = await page.screenshot(screenshotOptions);
      
     return Buffer.from(screenshotBuffer);
      
    } catch (error) {
      throw new PdfGenerationError(
        'SCREENSHOT_FAILED',
        'Failed to take screenshot',
        error as Error
      );
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================

   

 

  // private renderTable(config: any, _data: Record<string, any>): string {
  //   const rows = config?.rows || [];
  //   const columns = config?.columns || [];
    
  //   let tableHtml = '<table class="table">';
    
  //   // Header
  //   if (columns.length > 0) {
  //     tableHtml += '<thead><tr>';
  //     for (const column of columns) {
  //       tableHtml += `<th>${column.label || column.key || ''}</th>`;
  //     }
  //     tableHtml += '</tr></thead>';
  //   }
    
  //   // Body
  //   tableHtml += '<tbody>';
  //   for (const row of rows) {
  //     tableHtml += '<tr>';
  //     for (const column of columns) {
  //       const value = this.resolveValue(column.key, row) || row[column.key] || '';
  //       tableHtml += `<td>${value}</td>`;
  //     }
  //     tableHtml += '</tr>';
  //   }
  //   tableHtml += '</tbody></table>';
    
  //   return tableHtml;
  // }

  private renderHeader(headerConfig: any, data: Record<string, any>): string {
    return `
      <div class="header">
        ${this.resolveContent(headerConfig.content || '', data)}
      </div>
    `;
  }

  private renderFooter(footerConfig: any, data: Record<string, any>): string {
    return `
      <div class="footer">
        ${this.resolveContent(footerConfig.content || '', data)}
      </div>
    `;
  }

  private resolveValue(fieldName: string, data: Record<string, any>): any {
    if (!fieldName) return null;
    
    // Handle nested properties (e.g., "user.name")
    return fieldName.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : null;
    }, data);
  }

  private resolveContent(content: string, data: Record<string, any>): string {
    return content.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
      const value = this.resolveValue(key, data);
      return value !== null && value !== undefined ? String(value) : match;
    });
  }

  private getStyle(style: any): string {
    if (!style) return '';
    
    const styleProps = [];
    if (style.width) styleProps.push(`width: ${style.width};`);
    if (style.height) styleProps.push(`height: ${style.height};`);
    if (style.color) styleProps.push(`color: ${style.color};`);
    if (style.backgroundColor) styleProps.push(`background-color: ${style.backgroundColor};`);
    if (style.fontSize) styleProps.push(`font-size: ${style.fontSize};`);
    if (style.fontWeight) styleProps.push(`font-weight: ${style.fontWeight};`);
    if (style.textAlign) styleProps.push(`text-align: ${style.textAlign};`);
    if (style.margin) styleProps.push(`margin: ${style.margin};`);
    if (style.padding) styleProps.push(`padding: ${style.padding};`);
    if (style.border) styleProps.push(`border: ${style.border};`);
    
    return styleProps.join(' ');
  }

  private getPdfOptions(template: PdfTemplate, options?: PdfGenerationOptions): any {
    const defaultOptions = {
      format: template.pageSize || 'A4',
      landscape: template.orientation === 'LANDSCAPE',
      margin: template.margins || { top: '72px', right: '72px', bottom: '72px', left: '72px' },
      printBackground: true,
      displayHeaderFooter: !!(template.headerContent || template.footerContent),
      headerTemplate: template.headerContent 
        ? `<div style="font-size: 10px; text-align: center; width: 100%;">${template.headerContent}</div>`
        : '',
      footerTemplate: template.footerContent
        ? `<div style="font-size: 10px; text-align: center; width: 100%;">${template.footerContent}</div>`
        : '',
      preferCSSPageSize: true,
      timeout: 30000,
    };
    
    return { ...defaultOptions, ...options };
  }

  private getPdfOptionsFromOptions(options?: PdfGenerationOptions): any {
    const defaultOptions = {
      format: 'A4',
      landscape: false,
      margin: { top: '72px', right: '72px', bottom: '72px', left: '72px' },
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      timeout: 30000,
    };
    
    return { ...defaultOptions, ...options };
  }
}