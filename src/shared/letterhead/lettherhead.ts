// export function detectMimeType(buffer: Buffer): string | null {

import { Letterhead, MarginSafeZone } from '@domain/entities/letterhead.entity.js';
import { LetterheadAccessDeniedError, LetterheadDuplicateError, LetterheadError, LetterheadValidationError } from '@domain/errors/letterhead-error.js';
import { LetterheadType } from '@prisma/client';
import { ImageProcessor } from './image-processor.js';
import { LetterheadFile } from '@application/dto/letterhead.dto.js';
 
export const MIN_DIMENSION = 10;
export const MAX_DIMENSION = 10000;
export const BUCKET_NAME = 'letterheads';

//   if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
//     return 'application/pdf';
//   }
  
 
//   const uint8Array = new Uint8Array(buffer);
  
 
//   if (uint8Array.length >= 3 &&
//       uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
//     return 'image/jpeg';
//   }
  
 
//   if (uint8Array.length >= 8 &&
//       uint8Array[0] === 0x89 && uint8Array[1] === 0x50 &&
//       uint8Array[2] === 0x4E && uint8Array[3] === 0x47 &&
//       uint8Array[4] === 0x0D && uint8Array[5] === 0x0A &&
//       uint8Array[6] === 0x1A && uint8Array[7] === 0x0A) {
//     return 'image/png';
//   }
  
 
//   if (uint8Array.length >= 6 &&
//       ((uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46) ||
//        (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x38))) {
//     return 'image/gif';
//   }
  
 
//   if (uint8Array.length >= 12 &&
//       uint8Array[0] === 0x52 && uint8Array[1] === 0x49 &&
//       uint8Array[2] === 0x46 && uint8Array[3] === 0x46 &&
//       uint8Array[8] === 0x57 && uint8Array[9] === 0x45 &&
//       uint8Array[10] === 0x42 && uint8Array[11] === 0x50) {
//     return 'image/webp';
//   }
  
 
//   if (uint8Array.length >= 2 &&
//       uint8Array[0] === 0x42 && uint8Array[1] === 0x4D) {
//     return 'image/bmp';
//   }
  
 
//   if (uint8Array.length >= 4 &&
//       ((uint8Array[0] === 0x49 && uint8Array[1] === 0x49 && uint8Array[2] === 0x2A && uint8Array[3] === 0x00) ||
//        (uint8Array[0] === 0x4D && uint8Array[1] === 0x4D && uint8Array[2] === 0x00 && uint8Array[3] === 0x2A))) {
//     return 'image/tiff';
//   }
  
 
//   const svgString = buffer.toString('utf8', 0, Math.min(buffer.length, 200));
//   if (svgString.includes('<svg') || svgString.includes('<?xml')) {
//     return 'image/svg+xml';
//   }
  
//   return null;
// }
 

export async function detectMimeType(buffer: Buffer): Promise<string | null> {
  try {
    // 1️⃣ Primary detection using file-type
    const { fileTypeFromBuffer } = await import('file-type');
    const result = await fileTypeFromBuffer(buffer);

    if (result?.mime) {
      // 🔹 SVGs are often detected as XML
      if (
        result.mime === 'application/xml' ||
        result.mime === 'text/xml' ||
        result.mime === 'text/plain'
      ) {
        if (isSvg(buffer)) {
          return 'image/svg+xml';
        }
      }

      return result.mime;
    }
  } catch {
    // Ignore and fall back
  }

  // 2️⃣ Fallback: magic bytes + content sniffing
  // PDF
  if (buffer.slice(0, 5).toString() === '%PDF-') {
    return 'application/pdf';
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // GIF
  const gifHeader = buffer.slice(0, 6).toString();
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
    return 'image/gif';
  }

  // WEBP
  if (
    buffer.slice(0, 4).toString() === 'RIFF' &&
    buffer.slice(8, 12).toString() === 'WEBP'
  ) {
    return 'image/webp';
  }

  // BMP
  if (buffer.slice(0, 2).toString() === 'BM') {
    return 'image/bmp';
  }

  // SVG (content-based)
  if (isSvg(buffer)) {
    return 'image/svg+xml';
  }

  return null;
}

/**
 * Strict SVG detection (prevents accepting random XML)
 */
function isSvg(buffer: Buffer): boolean {
  const content = buffer.toString('utf8', 0, 1024).toLowerCase();

  return (
    content.includes('<svg') &&
    (
      content.includes('xmlns="http://www.w3.org/2000/svg"') ||
      content.includes('xmlns=\'http://www.w3.org/2000/svg\'') ||
      content.includes('<!doctype svg') ||
      content.includes('<?xml')
    )
  );
}


export   function isImageFile(mimetype: string): boolean {
  return mimetype.startsWith('image/');
}

export   function isPdfFile(mimetype: string): boolean {
  return mimetype === 'application/pdf';
}

export   function determineFileType(mimetype: string): LetterheadType {
  if (mimetype === 'application/pdf') return 'PDF';
  if (mimetype === 'image/svg+xml') return 'SVG';
  return 'IMAGE';
}

export   function validatePrintDimensions(dimensions: { width: number; height: number }): void {
 

  if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) {
    throw new LetterheadValidationError('INVALID_DIMENSIONS', [
      `Image dimensions (${dimensions.width}x${dimensions.height}) are too small.`,
    ]);
  }

  if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
    throw new LetterheadValidationError('INVALID_DIMENSIONS', [
      `Image dimensions (${dimensions.width}x${dimensions.height}) are too large.`,
    ]);
  }
}

export   function generateSafeFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const extension = originalFilename.includes('.')
    ? originalFilename.substring(originalFilename.lastIndexOf('.'))
    : '';

  const safeName = originalFilename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 100);

  return `letterhead_${timestamp}_${random}_${safeName}${extension}`;
}


export   function calculateMarginSafeZone(
dimensions?: { width: number; height: number }
): MarginSafeZone | null {
if (!dimensions) return null;

return {
  top: Math.max(Math.round(dimensions.height * 0.1), 20),
  right: Math.max(Math.round(dimensions.width * 0.1), 20),
  bottom: Math.max(Math.round(dimensions.height * 0.1), 20),
  left: Math.max(Math.round(dimensions.width * 0.1), 20),
};
}


export   function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export   function getErrorCode(error: unknown): string {
if (error instanceof LetterheadValidationError) return 'VALIDATION_ERROR';
if (error instanceof LetterheadDuplicateError) return 'DUPLICATE_ERROR';
if (error instanceof LetterheadError) return 'LETTERHEAD_ERROR';
return 'UNKNOWN_ERROR';
}

export   function  validateLetterHeadAccess(
  letterhead: Letterhead,
  userId: string,
  organizationId?: string | null
): void {

  if (letterhead.isPublic && letterhead.isActive) {
    return;  
  }


  if (letterhead.userId !== userId) {
    throw new LetterheadAccessDeniedError(letterhead.id);
  }


  if (organizationId && letterhead.organizationId && letterhead.organizationId !== organizationId) {
    throw new LetterheadAccessDeniedError(letterhead.id);
  }
}

export   function validateFile(file: LetterheadFile,maxFilemaxFileSize?: number): void {
  const errors: string[] = [];

  if (!file.data || file.data.length === 0) {
    errors.push('File is empty');
  }

  const maxSize = maxFilemaxFileSize || 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    errors.push(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/bmp',
    'image/svg+xml', // Explicitly include SVG
    'application/pdf',
  ];

  if (!allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    errors.push(`File type "${file.mimetype}" not supported.`);
  }

  if (errors.length > 0) {
    throw new LetterheadValidationError('INVALID_FILE', errors);
  }
}

export   async function blobToBuffer(blob: Blob): Promise<Buffer> {
  // Convert Blob to ArrayBuffer first
  const arrayBuffer = await blob.arrayBuffer();
  
  // Convert ArrayBuffer to Buffer
  return Buffer.from(arrayBuffer);
}

export   function mapStringToLetterheadType(fileType: string): LetterheadType {
  if (fileType === 'PDF' || fileType === 'IMAGE' || fileType === 'SVG') {
    return fileType as LetterheadType;
  }
  return 'IMAGE'; 
}

export   async function  getImageDimensions(
  buffer: Buffer,
  extension: string
): Promise<{ width: number; height: number } | undefined> {
  try {
    // List of supported image formats
    const supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'heic', 'heif', 'svg'];
    
    const ext = extension.toLowerCase();
   
    // Check if the format is supported by sharp
    if (!supportedFormats.includes(ext)) {
      console.log(`Image dimensions not supported for .${ext} files`);
      return undefined;
    }
    
    // Use sharp to get image metadata
    const sharp = await import('sharp');
    
    let sharpInstance: any;
    
    // Handle different formats appropriately
    switch (ext) {
      case 'gif':
        // For GIFs, get dimensions from first frame
        sharpInstance = sharp.default(buffer, { animated: false, pages: 1 });
        break;
      case 'svg':
        // For SVG, we need to render it to get dimensions
        try {
          // Try to parse SVG dimensions from the XML
          const svgString = buffer.toString('utf8');
          const widthMatch = svgString.match(/width=["']([^"']+)["']/);
          const heightMatch = svgString.match(/height=["']([^"']+)["']/);
          const viewBoxMatch = svgString.match(/viewBox=["']([^"']+)["']/);
          
          if (widthMatch && heightMatch) {
            // Parse numeric values (could be pixels, percentages, etc.)
            const width =  parseSvgDimension(widthMatch[1]);
            const height = parseSvgDimension(heightMatch[1]);
            
            if (width && height) {
              return { width, height };
            }
          }
          
          if (viewBoxMatch) {
            // Parse viewBox: "x y width height"
            const viewBoxParts = viewBoxMatch[1].split(/\s+/);
            if (viewBoxParts.length >= 4) {
              const width = parseFloat(viewBoxParts[2]);
              const height = parseFloat(viewBoxParts[3]);
              if (!isNaN(width) && !isNaN(height)) {
                return { width, height };
              }
            }
          }
          
          // Fallback: render SVG with sharp to get dimensions
          sharpInstance = sharp.default(buffer, { density: 72 });
          break;
        } catch (svgError) {
          console.warn('Failed to parse SVG, using sharp fallback:', svgError);
          sharpInstance = sharp.default(buffer, { density: 72 });
        }
        break;
      default:
        sharpInstance = sharp.default(buffer);
        break;
    }
    
    // Get metadata
    const metadata = await sharpInstance.metadata();
    
    if (metadata.width && metadata.height) {
      return {
        width: metadata.width,
        height: metadata.height
      };
    }
    
    console.warn('Could not extract dimensions from image metadata');
    return undefined;
    
  } catch (error) {
    console.warn('Failed to get image dimensions:', error);
    return undefined;
  }
}

// Helper method to parse SVG dimensions
export     function  parseSvgDimension(value: string): number | null {
  try {
    // Remove units (px, pt, cm, mm, in, em, ex, %, etc.)
    const numericValue = value.replace(/[^\d.-]/g, '');
    const num = parseFloat(numericValue);
    
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
    
    return null;
  } catch {
    return null;
  }
}

 
// Option 3: Combined implementation with both libraries as fallback
 