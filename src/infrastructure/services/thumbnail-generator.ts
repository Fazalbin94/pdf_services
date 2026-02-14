import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
 
import path from 'path';
import os from 'os';
import { SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
class ImageProcessorError extends Error {
  constructor(
    public code: string,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ImageProcessorError';
  }
}

class ThumbnailGenerator {
    private supabase: SupabaseClient;
    private defaultBucket: string;
  
    constructor(
      supabaseClient: SupabaseClient,
      bucketName: string = 'thumbnails'
    ) {
      this.supabase = supabaseClient;
      this.defaultBucket = bucketName;
    }

 
  async generateThumbnail(
    buffer: Buffer,
    options: {
      width: number;
      height: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    }
  ): Promise<Buffer> {
    try {
      // Use our unified detection and processing
      const fileType = await this.detectFileTypeFromBuffer(buffer);
      
      // Process based on file type
      switch (fileType.category) {
        case 'image':
          return await this.generateImageThumbnail(buffer, options, fileType);
        
        case 'pdf':
          return await this.generatePdfThumbnail(buffer, options);
        
        case 'svg':
          return await this.generateSvgThumbnail(buffer, options);
        
        case 'video':
          return await this.generateVideoThumbnail(buffer, options, fileType);
        
        default:
          // For unsupported types, generate a generic placeholder
          return await this.generateGenericPlaceholder(fileType, options);
      }
    } catch (error) {
      throw new ImageProcessorError(
        'THUMBNAIL_GENERATION_FAILED',
        'Failed to generate thumbnail',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

 

  // Helper method to detect file type from buffer only
  private async detectFileTypeFromBuffer(
    buffer: Buffer
  ): Promise<{
    category: 'image' | 'pdf' | 'video' | 'document' | 'svg' | 'audio' | 'other';
    mimeType: string;
    extension?: string;
  }> {
    try {
      const detected = await fileTypeFromBuffer(buffer);
      
      if (!detected) {
        // Fallback: check buffer content
        const fileStart = buffer.toString('utf8', 0, 100);
        
        if (fileStart.includes('<svg') || fileStart.includes('<?xml')) {
          return { category: 'svg', mimeType: 'image/svg+xml', extension: 'svg' };
        }
        
        if (fileStart.includes('%PDF')) {
          return { category: 'pdf', mimeType: 'application/pdf', extension: 'pdf' };
        }
        
        return { category: 'other', mimeType: 'application/octet-stream' };
      }
      
      const mime = detected.mime;
      const ext = detected.ext;
      
      // Categorize based on MIME type
      if (mime.startsWith('image/')) {
        if (mime === 'image/svg+xml') {
          return { category: 'svg', mimeType: mime, extension: ext };
        }
        return { category: 'image', mimeType: mime, extension: ext };
      }
      
      if (mime === 'application/pdf') {
        return { category: 'pdf', mimeType: mime, extension: ext };
      }
      
      if (mime.startsWith('video/')) {
        return { category: 'video', mimeType: mime, extension: ext };
      }
      
      return { category: 'other', mimeType: mime, extension: ext };
      
    } catch (error) {
      return { category: 'other', mimeType: 'application/octet-stream' };
    }
  }

  // Original detectFileType method (kept for compatibility)
  private async detectFileType(
    buffer: Buffer, 
    mimeType: string,
    originalFilename?: string
  ): Promise<{
    category: 'image' | 'pdf' | 'video' | 'document' | 'svg' | 'audio' | 'other';
    mimeType: string;
    extension?: string;
    name?: string;
  }> {
    const detected = await fileTypeFromBuffer(buffer);
    
    const mime = detected?.mime || mimeType;
    let ext = detected?.ext;
    
    if (!ext && originalFilename) {
      ext = originalFilename.split('.').pop()?.toLowerCase();
    }
    
    if (mime.startsWith('image/')) {
      if (mime === 'image/svg+xml') {
        return { 
          category: 'svg', 
          mimeType: mime, 
          extension: ext || 'svg',
          name: originalFilename
        };
      }
      return { 
        category: 'image', 
        mimeType: mime, 
        extension: ext,
        name: originalFilename
      };
    }
    
    if (mime === 'application/pdf') {
      return { 
        category: 'pdf', 
        mimeType: mime, 
        extension: ext || 'pdf',
        name: originalFilename
      };
    }
    
    if (mime.startsWith('video/')) {
      return { 
        category: 'video', 
        mimeType: mime, 
        extension: ext,
        name: originalFilename
      };
    }
    
    return { 
      category: 'other', 
      mimeType: mime, 
      extension: ext,
      name: originalFilename
    };
  }

  private isThumbnailSupported(category: string): boolean {
    const supported = ['image', 'pdf', 'svg', 'video'];
    return supported.includes(category);
  }

  private async generateImageThumbnail(
    buffer: Buffer,
    options: { width: number; height: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' },
    fileType: any
  ): Promise<Buffer> {
    let sharpInstance = sharp(buffer);
    
    // Handle different image types
    if (fileType.mimeType === 'image/jpeg') {
      sharpInstance = sharpInstance.rotate(); // Auto-rotate based on EXIF
    }
    
    const format = options.format || 'jpeg';
    const quality = options.quality || 85;
    
    // Use proper sharp method calls
    return sharpInstance
      .resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(format as any, { quality })
      .toBuffer();
  }

  private async generateSvgThumbnail(
    buffer: Buffer,
    options: { width: number; height: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' }
  ): Promise<Buffer> {
    console.log("generateSvgThumbnail called with format:", options.format);
    
    const format = options.format || 'png';  
    const quality = options.quality || 90;
    
    console.log("Using format:", format);
    
    return sharp(buffer, { density: 300 })
      .resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(format as any, { quality })
      .toBuffer();
  }

  private async generatePdfThumbnail(
    buffer: Buffer,
    options: { width: number; height: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' }
  ): Promise<Buffer> {
    try {
      // Try poppler-utils first
      if (await this.hasPoppler()) {
        return await this.convertPdfWithPoppler(buffer, options);
      }
      
      // Fallback to placeholder
      return await this.generatePdfPlaceholder(options);
      
    } catch (error) {
      console.warn('PDF thumbnail generation failed, using placeholder:', error);
      return await this.generatePdfPlaceholder(options);
    }
  }

  private async generateVideoThumbnail(
    buffer: Buffer,
    options: { width: number; height: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' },
    fileType: any
  ): Promise<Buffer> {
    try {
      // Try ffmpeg
      return await this.convertVideoWithFfmpeg(buffer, options, fileType);
    } catch (error) {
      console.log('Video thumbnail generation failed, using placeholder:', error);
      return await this.generateVideoPlaceholder(options);
    }
  }

  private async convertPdfWithPoppler(
    buffer: Buffer,
    options: { width: number; height: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' }
  ): Promise<Buffer> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const tempDir = os.tmpdir();
    const pdfPath = path.join(tempDir, `pdf_${Date.now()}.pdf`);
    const outputPath = path.join(tempDir, `pdf_thumb_${Date.now()}`);
    
    try {
      await fs.writeFile(pdfPath, buffer);
      
      const format = options.format === 'png' ? 'png' : 'jpeg';
      const quality = options.quality || 85;
      
      await execAsync(
        `pdftoppm -${format} -f 1 -l 1 -scale-to ${options.width} -singlefile ${pdfPath} ${outputPath}`
      );
      
      const thumbnailBuffer = await fs.readFile(`${outputPath}.${format}`);
      
      return await sharp(thumbnailBuffer)
        .resize(options.width, options.height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer();
        
    } finally {
      await Promise.allSettled([
        fs.unlink(pdfPath).catch(() => {}),
        fs.unlink(`${outputPath}.${options.format === 'png' ? 'png' : 'jpg'}`).catch(() => {})
      ]);
    }
  }

  private async convertVideoWithFfmpeg(
    buffer: Buffer,
    options: { width: number; height: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' },
    fileType: any
  ): Promise<Buffer> {
    const ffmpeg = await import('fluent-ffmpeg');
    
    return new Promise((resolve, reject) => {
      const tempPath = path.join(os.tmpdir(), `video_${Date.now()}.${fileType.extension || 'mp4'}`);
      
      fs.writeFile(tempPath, buffer)
        .then(() => {
          // ffmpeg is imported as a module with a .default export. Use ffmpeg.default.
          ffmpeg.default(tempPath)
            .screenshots({
              count: 1,
              folder: os.tmpdir(),
              filename: `thumb_${Date.now()}.jpg`,
              size: `${options.width}x${options.height}`
            })
            .on('end', async () => {
              try {
                const thumbPath = path.join(os.tmpdir(), `thumb_${Date.now()}.jpg`);
                const thumbBuffer = await fs.readFile(thumbPath);
                await fs.unlink(tempPath);
                await fs.unlink(thumbPath);
                resolve(thumbBuffer);
              } catch (error) {
                reject(error);
              }
            })
            .on('error', reject);
        })
        .catch(reject);
    });
  }

  private async generatePdfPlaceholder(
    options: { width: number; height: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' }
  ): Promise<Buffer> {
    const svg = `
      <svg width="${options.width}" height="${options.height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <rect x="10%" y="10%" width="80%" height="20%" fill="#4a90e2" rx="5"/>
        <rect x="10%" y="40%" width="60%" height="10%" fill="#ccc" rx="3"/>
        <rect x="10%" y="55%" width="70%" height="10%" fill="#ccc" rx="3"/>
        <rect x="10%" y="70%" width="50%" height="10%" fill="#ccc" rx="3"/>
        <text x="50%" y="22%" text-anchor="middle" font-family="Arial" font-size="16" fill="white">PDF</text>
      </svg>
    `;
    
    return sharp(Buffer.from(svg))
      .toFormat(options.format || 'png', { quality: options.quality || 90 })
      .toBuffer();
  }

  private async generateVideoPlaceholder(
    options: { width: number; height: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' }
  ): Promise<Buffer> {
    const svg = `
      <svg width="${options.width}" height="${options.height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1a1a1a"/>
        <circle cx="50%" cy="50%" r="${Math.min(options.width, options.height) * 0.2}" fill="rgba(255,255,255,0.2)"/>
        <polygon points="45%,40% 65%,50% 45%,60%" fill="white"/>
        <text x="50%" y="85%" text-anchor="middle" font-family="Arial" font-size="12" fill="white">VIDEO</text>
      </svg>
    `;
    
    return sharp(Buffer.from(svg))
      .toFormat(options.format || 'png', { quality: options.quality || 90 })
      .toBuffer();
  }

  private async generateGenericPlaceholder(
    fileType: any,
    options: { width: number; height: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' }
  ): Promise<Buffer> {
    const svg = `
      <svg width="${options.width}" height="${options.height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <rect x="20%" y="30%" width="60%" height="40%" fill="#ddd" rx="10"/>
        <text x="50%" y="52%" text-anchor="middle" font-family="Arial" font-size="20" fill="#666">📄</text>
        <text x="50%" y="80%" text-anchor="middle" font-family="Arial" font-size="10" fill="#888">FILE</text>
      </svg>
    `;
    
    return sharp(Buffer.from(svg))
      .toFormat(options.format || 'png', { quality: options.quality || 90 })
      .toBuffer();
  }

  private async hasPoppler(): Promise<boolean> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync('pdftoppm -v');
      return true;
    } catch {
      return false;
    }
  }

  
     
  // Helper method to get public URL
//   async getThumbnailUrl(thumbnailPath: string): Promise<string> {
//     if (!this.supabase) {
//       throw new Error('Supabase client not configured');
//     }
    
//     const { data } = this.supabase.storage
//       .from(this.defaultBucket)
//       .getPublicUrl(thumbnailPath);
    
//     return data.publicUrl;
//   }
}

// Export for use
export { ThumbnailGenerator, ImageProcessorError };