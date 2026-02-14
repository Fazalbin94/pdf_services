// Add these helper methods to your class:

import { LetterheadType } from '@prisma/client';

 
 
  export   function getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      tiff: 'image/tiff',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
     
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }
     
  export function extractExtension(input: string): string | null {
   
    const clean = input.split('?')[0];
    
    // Try to find a real extension
    const parts = clean.split('.');
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1].toLowerCase().trim();
      // Check if it looks like a valid extension (2-5 letters/numbers)
      if (/^[a-z0-9]{2,5}$/.test(lastPart)) {
        return lastPart;
      }
    }
    
    return null;
  }

    // Add this helper method to your class:
    export  function getMimeTypeFromExtension(extension: string): string {
        const mimeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'webp': 'image/webp',
          'gif': 'image/gif',
          'bmp': 'image/bmp',
          'svg': 'image/svg+xml',
          'pdf': 'application/pdf',
          'xml': 'application/xml',
          'txt': 'text/plain',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        };
        
        return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
      }

      //


      // Option 1: Simple function with cached import
let fileTypeModule: any = null;

async function getFileTypeModule() {
  if (!fileTypeModule) {
    fileTypeModule = await import('file-type');
  }
  return fileTypeModule;
}

export async function detectFileTypeFromBuffer(buffer: Buffer): Promise<{
  ext: string | null;
  mime: string | null;
  detectedBy: 'file-type' | 'signature' | null;
}> {
  try {
    // Method 1: Use file-type library (most accurate)
    const fileType = await getFileTypeModule();
    const detected = await fileType.fileTypeFromBuffer(buffer);
    
    if (detected) {
      return {
        ext: detected.ext,
        mime: detected.mime,
        detectedBy: 'file-type'
      };
    }
    
    // Method 2: Check file signatures (fallback)
    const signatureResult = checkFileSignature(buffer);
    if (signatureResult) {
      return {
        ext: signatureResult.ext,
        mime: signatureResult.mime,
        detectedBy: 'signature'
      };
    }
    
    return { ext: null, mime: null, detectedBy: null };
    
  } catch (error) {
    console.error('Failed to detect file type from buffer:', error);
    return { ext: null, mime: null, detectedBy: null };
  }
}

// Helper function for signature checking
function checkFileSignature(buffer: Buffer): { ext: string; mime: string } | null {
  if (buffer.length < 4) return null;
  
  const signatures = [
    // Images
    { sig: [0xFF, 0xD8, 0xFF], ext: 'jpg', mime: 'image/jpeg' },
    { sig: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], ext: 'png', mime: 'image/png' },
    { sig: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], ext: 'gif', mime: 'image/gif' }, // GIF87a
    { sig: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], ext: 'gif', mime: 'image/gif' }, // GIF89a
    { sig: [0x52, 0x49, 0x46, 0x46], check: (buf: Buffer) => { // RIFF
      return buf.length >= 12 && 
             buf.slice(8, 12).equals(Buffer.from('WEBP', 'ascii'));
    }, ext: 'webp', mime: 'image/webp' },
    { sig: [0x42, 0x4D], ext: 'bmp', mime: 'image/bmp' },
    { sig: [0x49, 0x49, 0x2A, 0x00], ext: 'tif', mime: 'image/tiff' }, // Little-endian TIFF
    { sig: [0x4D, 0x4D, 0x00, 0x2A], ext: 'tif', mime: 'image/tiff' }, // Big-endian TIFF
    { sig: [0x00, 0x00, 0x01, 0x00], ext: 'ico', mime: 'image/x-icon' },
    
    // Documents
    { sig: [0x25, 0x50, 0x44, 0x46], ext: 'pdf', mime: 'application/pdf' }, // %PDF
    { sig: [0x50, 0x4B, 0x03, 0x04], ext: 'zip', mime: 'application/zip' }, // ZIP (also docx, xlsx, pptx)
    { sig: [0x50, 0x4B, 0x05, 0x06], ext: 'zip', mime: 'application/zip' }, // Empty ZIP
    { sig: [0x50, 0x4B, 0x07, 0x08], ext: 'zip', mime: 'application/zip' }, // Spanned ZIP
    
    // Office Documents (ZIP-based)
    { sig: [0x50, 0x4B, 0x03, 0x04], check: (buf: Buffer) => {
      // Check if it's an Office document by looking for specific files in ZIP
      if (buf.length < 100) return false;
      // This is a simplified check - in reality you'd need to parse ZIP structure
      const asString = buf.toString('utf8', 0, 100);
      return asString.includes('[Content_Types].xml');
    }, ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    
    // SVG (text-based, check for XML/SVG declaration)
    { sig: [], check: (buf: Buffer) => {
      const str = buf.toString('utf8', 0, 200).trim();
      return str.startsWith('<?xml') && str.includes('<svg') ||
             str.startsWith('<svg') ||
             str.includes('xmlns="http://www.w3.org/2000/svg"');
    }, ext: 'svg', mime: 'image/svg+xml' },
    
    // Text/XML
    { sig: [0x3C, 0x3F, 0x78, 0x6D, 0x6C, 0x20], ext: 'xml', mime: 'application/xml' }, // <?xml
    { sig: [0xEF, 0xBB, 0xBF], offset: 0, ext: 'txt', mime: 'text/plain' }, // UTF-8 BOM
    
    // Audio/Video
    { sig: [0x49, 0x44, 0x33], ext: 'mp3', mime: 'audio/mpeg' }, // ID3 (MP3)
    { sig: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], ext: 'mp4', mime: 'video/mp4' }, // MP4
    { sig: [0x1A, 0x45, 0xDF, 0xA3], ext: 'webm', mime: 'video/webm' }, // WebM
    { sig: [0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11], ext: 'wmv', mime: 'video/x-ms-wmv' },
    
    // Archives
    { sig: [0x1F, 0x8B], ext: 'gz', mime: 'application/gzip' },
    { sig: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], ext: '7z', mime: 'application/x-7z-compressed' },
    { sig: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00], ext: 'rar', mime: 'application/vnd.rar' },
  ];
  
  for (const signature of signatures) {
    if (signature.check) {
      // Custom check function
      if (signature.check(buffer)) {
        return { ext: signature.ext, mime: signature.mime };
      }
    } else if (signature.sig.length > 0) {
      // Simple byte signature check
      const offset = signature.offset || 0;
      if (buffer.length >= offset + signature.sig.length) {
        const sigBuffer = Buffer.from(signature.sig);
        if (buffer.slice(offset, offset + signature.sig.length).equals(sigBuffer)) {
          return { ext: signature.ext, mime: signature.mime };
        }
      }
    }
  }
  
  return null;
}

// Option 2: Simpler version (just extension detection)
export async function detectExtensionFromBuffer(buffer: Buffer): Promise<string | null> {
  const result = await detectFileTypeFromBuffer(buffer);
  return result.ext;
}

// Option 3: With file size optimization (check only first bytes)
export async function detectExtensionFromBufferOptimized(
  buffer: Buffer, 
  maxBytes: number = 4100 // First 4KB is usually enough
): Promise<string | null> {
  try {
    // Use only first bytes for performance
    const sampleBuffer = buffer.slice(0, Math.min(buffer.length, maxBytes));
    
    const fileType = await getFileTypeModule();
    const detected = await fileType.fileTypeFromBuffer(sampleBuffer);
    
    if (detected?.ext) {
      return detected.ext;
    }
    
    // Fallback to signature check on sample
    const signatureResult = checkFileSignature(sampleBuffer);
    return signatureResult?.ext || null;
    
  } catch (error) {
    console.error('Failed to detect extension from buffer:', error);
    return null;
  }
}
export   function mimeTypeToExtension(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/svg+xml': 'svg',  
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  console.log("mimeTypess",mimeType)
  return mimeMap[mimeType.toLowerCase()] || 'bin';
}
export function normalizeExtensionFromBuffer(
  buffer: Buffer,
  detectedExt: string | null
): string {
  // SVG detection (XML-based)
  const header = buffer.toString('utf8', 0, 200).toLowerCase();

  if (
    detectedExt === 'xml' &&
    (header.includes('<svg') ||
     header.includes('xmlns="http://www.w3.org/2000/svg"'))
  ) {
    return 'svg';
  }

  return detectedExt ?? 'bin';
}


export function  stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}


 // Helper method to extract file extension
 export function getFileExtension(mimetype: string, filename?: string): string {
  // Try to get extension from filename first
  if (filename && filename.includes('.')) {
    const parts = filename.split('.');
    return parts[parts.length - 1].toLowerCase();
  }
  
  // Fall back to mimetype
  if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return 'jpg';
  if (mimetype.includes('png')) return 'png';
  if (mimetype.includes('gif')) return 'gif';
  if (mimetype.includes('webp')) return 'webp';
  if (mimetype.includes('svg')) return 'svg';
  if (mimetype.includes('pdf')) return 'pdf';
  
  return 'jpg'; // Default
}

// Helper method to determine file type
export function determineFileType(mimetype: string): LetterheadType {
  if (mimetype.includes('pdf')) return 'PDF';
  if (mimetype.includes('svg')) return 'SVG';
  return 'IMAGE'; // Default for all image types
}

// Helper to verify thumbnail exists
