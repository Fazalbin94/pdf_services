 import sharp from 'sharp';
import { DOMParser } from '@xmldom/xmldom';
import puppeteer from 'puppeteer-core'; // or 'puppeteer' if you prefer
import { ImageProcessorError } from '@domain/errors/image-processor-error.js';
import { ThumbnailGenerator } from '@infrastructure/services/thumbnail-generator.js';
import { detectExtensionFromBufferOptimized, mimeTypeToExtension } from '@shared/utils/extensionUtil.js';
import { MAX_DIMENSION, MIN_DIMENSION } from './lettherhead.js';
 
export class ImageProcessor {
  private browser: puppeteer.Browser | null = null;
  private browserPromise: Promise<puppeteer.Browser> | null = null;
 
  constructor(
    private readonly puppeteerOptions?: puppeteer.LaunchOptions,
    private  readonly generatorAc?:ThumbnailGenerator
  ) {
   
  }

  async extractMetadata(buffer: Buffer): Promise<{
    dimensions?: { width: number; height: number };
    dpi?: number;
    format: string;
  }> {
    try {
      // Detect file type from buffer
      const fileStart = buffer.toString('utf8', 0, 200);
      
      // Check for SVG
      if (fileStart.includes('<svg') || fileStart.includes('<?xml')) {
        return await this.extractSvgMetadata(buffer);
      }
      
      // Check for PDF
      if (fileStart.includes('%PDF')) {
        return await this.extractPdfMetadata(buffer);
      }
      
      // For raster images (JPEG, PNG, etc.), use sharp
      const metadata = await sharp(buffer).metadata();
      
      return {
        dimensions: metadata.width && metadata.height 
          ? { width: metadata.width, height: metadata.height }
          : undefined,
        dpi: metadata.density || 72,
        format: metadata.format || 'unknown',
      };
    } catch (error) {
      throw new ImageProcessorError(
        'METADATA_EXTRACTION_FAILED',
        'Failed to extract image metadata',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async extractSvgMetadata(buffer: Buffer): Promise<{
    dimensions?: { width: number; height: number };
    dpi: number;
    format: string;
  }> {
    try {
      const svgContent = buffer.toString('utf8');
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      
      let width = 0;
      let height = 0;
      
      // Try to get dimensions from viewBox attribute
      const svgElement = svgDoc.documentElement;
      const viewBox = svgElement.getAttribute('viewBox');
      
      if (viewBox) {
        const [x, y, w, h] = viewBox.split(' ').map(parseFloat);
        width = w || 0;
        height = h || 0;
      }
      
      // Fallback to width/height attributes
      if (!width || !height) {
        width = parseFloat(svgElement.getAttribute('width') || '0');
        height = parseFloat(svgElement.getAttribute('height') || '0');
      }
      
      // Default to A4 dimensions if still unknown
      if (!width || !height) {
        width = 595; // A4 width in points (72 DPI)
        height = 842; // A4 height in points
      }
      
      return {
        dimensions: { width, height },
        dpi: 72,
        format: 'svg',
      };
    } catch (error) {
      // Fallback to default dimensions if parsing fails
      return {
        dimensions: { width: 595, height: 842 },
        dpi: 72,
        format: 'svg',
      };
    }
  }

  private async extractPdfMetadata(buffer: Buffer): Promise<{
    dimensions?: { width: number; height: number };
    dpi: number;
    format: string;
  }> {
    try {
      const dimensions = await this.getPdfDimensionsWithPuppeteer(buffer);
      
      return {
        dimensions: { width: dimensions.width, height: dimensions.height },
        dpi: dimensions.dpi,
        format: 'pdf',
      };
    } catch (error) {
      console.warn('Puppeteer PDF extraction failed, trying fallback:', error);
      
      // Fallback to simple PDF header parsing
      const fallbackDimensions = await this.getPdfDimensionsSimple(buffer);
      
      return {
        dimensions: { width: fallbackDimensions.width, height: fallbackDimensions.height },
        dpi: fallbackDimensions.dpi,
        format: 'pdf',
      };
    }
  }

  private async getPdfDimensionsWithPuppeteer(buffer: Buffer): Promise<{ width: number; height: number; dpi: number }> {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      
      try {
        // Convert buffer to data URL for Puppeteer
        const base64 = buffer.toString('base64');
        const dataUrl = `data:application/pdf;base64,${base64}`;
        
        // Navigate to the PDF data URL
        await page.goto(dataUrl, {
          waitUntil: 'networkidle0',
          timeout: 10000,
        });
        
        // Wait a bit for PDF to render
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get dimensions by evaluating in page context
        const dimensions = await page.evaluate(() => {
          // Try to find PDF viewer container
          const pdfViewer = document.querySelector('[data-loaded="true"]') || 
                           document.querySelector('embed[type="application/pdf"]') ||
                           document.querySelector('iframe');
          
          if (pdfViewer) {
            return {
              width: pdfViewer.clientWidth,
              height: pdfViewer.clientHeight,
            };
          }
          
          // Check for PDF.js viewer (common in browsers)
          const pdfJsViewer = document.querySelector('#viewerContainer');
          if (pdfJsViewer) {
            return {
              width: pdfJsViewer.clientWidth,
              height: pdfJsViewer.clientHeight,
            };
          }
          
          // Fallback to viewport
          return {
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight,
          };
        });
        
        // Convert pixels to points (assuming 96 DPI)
        // 1 pixel = 0.75 points at 96 DPI
        const widthInPoints = Math.round(dimensions.width * 0.75);
        const heightInPoints = Math.round(dimensions.height * 0.75);
        
        return {
          width: widthInPoints,
          height: heightInPoints,
          dpi: 96,
        };
        
      } finally {
        await page.close();
      }
    } catch (error) {
      throw new Error(`Puppeteer PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getPdfDimensionsSimple(buffer: Buffer): Promise<{ width: number; height: number; dpi: number }> {
    try {
      // Simple PDF header parsing
      const pdfString = buffer.toString('ascii', 0, 5000);
      
      // Look for MediaBox (most reliable)
      const mediaBoxMatch = pdfString.match(/MediaBox\s*\[\s*([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s*\]/);
      
      if (mediaBoxMatch) {
        const x1 = parseFloat(mediaBoxMatch[1]);
        const y1 = parseFloat(mediaBoxMatch[2]);
        const x2 = parseFloat(mediaBoxMatch[3]);
        const y2 = parseFloat(mediaBoxMatch[4]);
        
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        
        return { width, height, dpi: 72 };
      }
      
      // Look for CropBox as fallback
      const cropBoxMatch = pdfString.match(/CropBox\s*\[\s*([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s*\]/);
      
      if (cropBoxMatch) {
        const x1 = parseFloat(cropBoxMatch[1]);
        const y1 = parseFloat(cropBoxMatch[2]);
        const x2 = parseFloat(cropBoxMatch[3]);
        const y2 = parseFloat(cropBoxMatch[4]);
        
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        
        return { width, height, dpi: 72 };
      }
      
      // Look for page size in trailer
      const pageSizeMatch = pdfString.match(/\/(Media|Crop)Box\s*\[\s*0\s+0\s+([0-9\.]+)\s+([0-9\.]+)\s*\]/);
      
      if (pageSizeMatch) {
        const width = parseFloat(pageSizeMatch[2]);
        const height = parseFloat(pageSizeMatch[3]);
        
        return { width, height, dpi: 72 };
      }
      
      throw new Error('Could not find PDF dimensions in header');
    } catch (error) {
      console.warn('Simple PDF parsing failed:', error);
      // Ultimate fallback: assume A4
      return { width: 595, height: 842, dpi: 72 };
    }
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    // Use singleton pattern to reuse browser
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
        ...this.puppeteerOptions,
      });
      
      this.browser = await this.browserPromise;
    }
    
    return this.browser!;
  }

  
   
  

  async validatePrintDimensions(dimensions: { width: number; height: number }): Promise<void> {
  
    if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) {
      throw new ImageProcessorError(
        'INVALID_DIMENSIONS',
        `Image dimensions (${dimensions.width}x${dimensions.height}) are too small. Minimum: ${MIN_DIMENSION}x${MIN_DIMENSION} points.`
      );
    }
    
    if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
      throw new ImageProcessorError(
        'INVALID_DIMENSIONS',
        `Image dimensions (${dimensions.width}x${dimensions.height}) are too large. Maximum: ${MAX_DIMENSION}x${MAX_DIMENSION} points.`
      );
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserPromise = null;
    }
  }

  // Helper method to convert points to pixels
  pointsToPixels(points: number, dpi: number = 72): number {
    return Math.round((points * dpi) / 72);
  }

  // Helper method to convert pixels to points
  pixelsToPoints(pixels: number, dpi: number = 72): number {
    return Math.round((pixels * 72) / dpi);
  }

  // Detect file type from buffer
  detectFileType(buffer: Buffer): string {
    const fileStart = buffer.toString('utf8', 0, 200);
    
    if (fileStart.includes('<svg') || fileStart.includes('<?xml')) {
      return 'svg';
    }
    
    if (fileStart.includes('%PDF')) {
      return 'pdf';
    }
    
    // Check for image signatures
    const signatures = {
      'jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
      'png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
      'gif': Buffer.from([0x47, 0x49, 0x46]),
      'webp': Buffer.from([0x52, 0x49, 0x46, 0x46]),
      'tiff': Buffer.from([0x49, 0x49, 0x2A, 0x00]), // Little endian
    };
    
    for (const [type, signature] of Object.entries(signatures)) {
      if (buffer.slice(0, signature.length).equals(signature)) {
        return type;
      }
    }
    
    return 'unknown';
  }
  
  async handlePdfDimensions(
    buffer: Buffer,
    requestId: string
  ): Promise<{ width: number; height: number; dpi?: number }> {
    console.log(`[${requestId}] handlePdfDimensions called`);
  
    try {
      try {
        const pdfParse = (await import('pdf-parse')) as unknown as (
          buffer: Buffer
        ) => Promise<any>;
        
        const data = await pdfParse(buffer);
        
  
        console.log(`[${requestId}] PDF parsed successfully`, {
          pages: data.numpages,
          info: data.info
        });
  
        // Default to A4 @ 300 DPI if no size info
        return {
          width: 2480,
          height: 3508,
          dpi: 300
        };
      } catch (pdfParseError) {
        console.warn(
          `[${requestId}] pdf-parse failed`,
          pdfParseError instanceof Error ? pdfParseError.message : pdfParseError
        );
      }
  
      // ---- MediaBox fallback ----
      const header = buffer.toString('utf8', 0, 2000);
      const mediaBoxMatch = header.match(/\/MediaBox\s*\[\s*([\d.\s]+)\s*\]/);
  
      if (mediaBoxMatch) {
        const [x1, y1, x2, y2] = mediaBoxMatch[1]
          .trim()
          .split(/\s+/)
          .map(Number);
  
        const widthPts = Math.abs(x2 - x1);
        const heightPts = Math.abs(y2 - y1);
  
        // PDF points → pixels @300 DPI
        return {
          width: Math.round((widthPts / 72) * 300),
          height: Math.round((heightPts / 72) * 300),
          dpi: 300
        };
      }
  
      // Safe default
      return { width: 2480, height: 3508, dpi: 300 };
    } catch (error) {
      console.error(`[${requestId}] handlePdfDimensions failed`, error);
      return { width: 2480, height: 3508, dpi: 300 };
    }
  }
  
  
    handleSvgDimensions(
    buffer: Buffer, 
    requestId: string
  ): Promise<{ width: number; height: number; dpi?: number }> {
    console.log(`[${requestId}] handleSvgDimensions called`);
    
    try {
      const svgContent = buffer.toString('utf-8');
      console.log(`[${requestId}] SVG content length:`, svgContent.length);
      
      
      const patterns = [
        /width="([^"]+)"/i,
        /width='([^']+)'/i,
        /width\s*=\s*([^\s>]+)/i,
        /viewBox="[^"]*\s+([^\s"]+)\s+([^\s"]+)"/i,
        /viewBox='[^']*\s+([^\s']+)\s+([^\s']+)'/i
      ];
      
      let width = 0;
      let height = 0;
      
      for (const pattern of patterns) {
        const match = svgContent.match(pattern);
        if (match) {
          console.log(`[${requestId}] Pattern matched:`, pattern.source, match);
          
          if (pattern.source.includes('viewBox')) {
            // viewBox gives width and height together
            const [, w, h] = match[0].match(/viewBox=["']?[^"']*["']?\s+([^\s"']+)\s+([^\s"']+)/i) || [];
            if (w && h) {
              width = parseFloat(w);
              height = parseFloat(h);
              break;
            }
          } else {
            // Regular width/height attribute
            const value = match[1];
            const numValue = parseFloat(value);
            
            if (!isNaN(numValue)) {
              if (pattern.source.includes('width')) {
                width = numValue;
              } else if (pattern.source.includes('height')) {
                height = numValue;
              }
            }
          }
        }
      }
      
      // If we found one dimension but not the other, look for the counterpart
      if (width > 0 && height === 0) {
        const heightMatch = svgContent.match(/height="([^"]+)"/i);
        if (heightMatch) {
          height = parseFloat(heightMatch[1]) || 0;
        }
      } else if (height > 0 && width === 0) {
        const widthMatch = svgContent.match(/width="([^"]+)"/i);
        if (widthMatch) {
          width = parseFloat(widthMatch[1]) || 0;
        }
      }
      
      console.log(`[${requestId}] SVG dimensions extracted:`, { width, height });
      
      // If no dimensions found, use default
      if (width === 0 || height === 0) {
        console.warn(`[${requestId}] No valid SVG dimensions found, using defaults`);
        return Promise.resolve({
          width: width || 1024,
          height: height || 768,
          dpi: 72
        });
      }
      
      return Promise.resolve({
        width,
        height,
        dpi: 72
      });
      
    } catch (error) {
      console.error(`[${requestId}] handleSvgDimensions failed:`, error);
      return Promise.resolve({
        width: 1024,
        height: 768,
        dpi: 72
      });
    }
  }
  
    getBasicImageInfo(
    buffer: Buffer, 
    mimetype: string,
    requestId: string
  ): { width: number; height: number; dpi?: number } {
    console.log(`[${requestId}] Using basic image info fallback`);
    
    //  get info from file header for common formats
    if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
      return this.extractJpegDimensions(buffer, requestId);
    }
    
    if (mimetype === 'image/png') {
      return this.extractPngDimensions(buffer, requestId);
    }
    
    // Generic fallback based on file size (very rough estimate)
    const fileSizeKB = buffer.length / 1024;
    let estimatedWidth = 800;
    let estimatedHeight = 600;
    
    if (fileSizeKB > 1000) {
      estimatedWidth = 1920;
      estimatedHeight = 1080;
    } else if (fileSizeKB > 500) {
      estimatedWidth = 1280;
      estimatedHeight = 720;
    } else if (fileSizeKB > 100) {
      estimatedWidth = 1024;
      estimatedHeight = 768;
    }
    
    console.log(`[${requestId}] Estimated dimensions from file size:`, {
      fileSizeKB: Math.round(fileSizeKB),
      estimatedWidth,
      estimatedHeight
    });
    
    return {
      width: estimatedWidth,
      height: estimatedHeight,
      dpi: undefined
    };
  }
  
    extractJpegDimensions(
    buffer: Buffer, 
    requestId: string
  ): { width: number; height: number; dpi?: number } {
    try {
      // JPEG SOI marker
      if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
        throw new Error('Not a valid JPEG file');
      }
      
      let offset = 2;
      while (offset < buffer.length) {
        // Marker
        if (buffer[offset] !== 0xFF) break;
        
        const marker = buffer[offset + 1];
        
        // SOF0-SOF2 markers contain dimension info
        if (marker >= 0xC0 && marker <= 0xC2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          
          console.log(`[${requestId}] Extracted JPEG dimensions from header:`, {
            width, height, marker: marker.toString(16)
          });
          
          return { width, height, dpi: undefined };
        }
        
        // Skip to next marker
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    } catch (error) {
      console.warn(`[${requestId}] Failed to extract JPEG dimensions:`, error);
    }
    
    return { width: 0, height: 0, dpi: undefined };
  }
  
    extractPngDimensions(
    buffer: Buffer, 
    requestId: string
  ): { width: number; height: number; dpi?: number } {
    try {
      // PNG signature
      if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        throw new Error('Not a valid PNG file');
      }
      
      // Look for IHDR chunk
      let offset = 8; // Skip PNG signature
      while (offset < buffer.length - 12) {
        const chunkLength = buffer.readUInt32BE(offset);
        const chunkType = buffer.toString('ascii', offset + 4, offset + 8);
        
        if (chunkType === 'IHDR') {
          const width = buffer.readUInt32BE(offset + 8);
          const height = buffer.readUInt32BE(offset + 12);
          
          console.log(`[${requestId}] Extracted PNG dimensions from IHDR:`, {
            width, height, chunkType
          });
          
          return { width, height, dpi: undefined };
        }
        
        offset += 12 + chunkLength; // Move to next chunk
      }
    } catch (error) {
      console.warn(`[${requestId}] Failed to extract PNG dimensions:`, error);
    }
    
    return { width: 0, height: 0, dpi: undefined };
  }
}