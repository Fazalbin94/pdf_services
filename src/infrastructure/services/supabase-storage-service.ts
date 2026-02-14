// src/infrastructure/services/storage-service.ts
import { IConfig } from '@application/dto/letterhead.dto.js';
import { StorageError } from '@domain/errors/storage-error.js';
import { DownloadFileResult } from '@presentation/http/letterheads/types/letterhead.response.js';
import { blobToBuffer, BUCKET_NAME, getImageDimensions } from '@shared/letterhead/lettherhead.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { ThumbnailGenerator } from './thumbnail-generator.js';
import { detectExtensionFromBuffer, extractExtension, getMimeType, getMimeTypeFromExtension, mimeTypeToExtension, normalizeExtensionFromBuffer, stripExtension } from '@shared/utils/extensionUtil.js';
import { ImageProcessor } from '@shared/letterhead/image-processor.js';
 
export interface StorageUploadOptions {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
  metadata?: Record<string, string>;
}

export interface SignedUrlOptions {
  expiresIn?: number; 
  download?: boolean;
  downloadName?: string;
}

export class SupabaseStorageService  {
  private supabase: SupabaseClient;
  private readonly defaultBucket: string;
  private _serviceRoleKey: string;

 
  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
    bucketName: string = BUCKET_NAME,
    private readonly thumbnailGenerator: ThumbnailGenerator,
    private readonly imageProcessor: ImageProcessor,
  ) {
     this._serviceRoleKey = serviceRoleKey;
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.defaultBucket = bucketName;
    
  }
 
 
  async getSecureUrl(
    filePath: string,
    options?: {
      expiresIn?: number;
      download?: boolean;
      downloadName?: string;
      contentType?: string;
    }
  ): Promise<{
    signedUrl: string;
    expiresAt: Date;
    contentType: string;
  }> {
    if (!filePath) {
      throw new Error('getSecureUrl called with empty filePath');
    }
  
    const expiresIn = options?.expiresIn ?? 3600;
  
    const { data, error } = await this.supabase.storage
      .from(this.defaultBucket)
      .createSignedUrl(filePath, expiresIn, {
        download: options?.download
          ? options.downloadName ?? true
          : false,
      });
  
    if (error || !data?.signedUrl) {
      throw new StorageError(
        'SIGNED_URL_FAILED',
        `Failed to generate signed URL: ${error?.message ?? 'Unknown error'}`,
         
      );
    }
  
    return {
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      contentType: options?.contentType ?? 'application/octet-stream',
    };
  }
  
async uploadPdf(
  buffer: Buffer,
  options?: {
    filename?: string;
    folder?: 'permanent' | 'previews';
    userId?: string;
    templateId?: string;
    metadata?: Record<string, string>;
  }
): Promise<{
  url: string;
  path: string;
  publicUrl: string;
  fileId: string;
}> {
  try {
    console.log('Starting PDF upload...');
    const fileId = uuidv4();
    const timestamp = Date.now();
    const folder = options?.folder || 'permanent';
    const userId = options?.userId || 'system';
    
    // Generate unique filename
    const fileName = options?.filename || `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`;
    const filePath = `${folder}/${userId}/${fileName}`;

    console.log('Upload parameters:', {
      bucket: this.defaultBucket,
      filePath,
      fileSize: buffer.length,
      folder,
      userId,
    });

    // Try to upload with upsert: true (overwrites if exists)
    const { data, error } = await this.supabase.storage
      .from(this.defaultBucket)
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true, // This overwrites existing files
        duplex: 'half',
        metadata: {
          fileId,
          userId: options?.userId || 'system',
          templateId: options?.templateId || '',
          folder,
          uploadedAt: new Date().toISOString(),
          size: buffer.length.toString(),
          ...options?.metadata,
        },
      });

    if (error) {
      console.error('Supabase upload error:', error);
      
      // If error is "already exists", try with a different name
      if (error.message.includes('already exists') || error.cause === '409') {
        console.log('File already exists, generating new name...');
        
        // Generate new unique name
        const newFileName = `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`;
        const newFilePath = `${folder}/${userId}/${newFileName}`;
        
        console.log('Trying new file path:', newFilePath);
        
        // Upload with new filename
        const { error: newError } = await this.supabase.storage
          .from(this.defaultBucket) // Use this.defaultBucket, not 'letterheads'
          .upload(newFilePath, buffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: true,
          });
        
        if (newError) {
          throw new StorageError(
            'UPLOAD_FAILED', 
            `Failed to upload PDF even with new name: ${newError.message}`
          );
        }
        
        // Get public URL for the new file
        const { data: newPublicUrlData } = this.supabase.storage
          .from(this.defaultBucket)
          .getPublicUrl(newFilePath);
        
        console.log('Upload successful with new name:', newPublicUrlData.publicUrl);
        
        return {
          url: `${this.supabaseUrl}/storage/v1/object/${this.defaultBucket}/${newFilePath}`,
          path: newFilePath,
          publicUrl: newPublicUrlData.publicUrl,
          fileId,
        };
      }
      
      throw new StorageError('UPLOAD_FAILED', `Failed to upload PDF: ${error.message}`);
    }

    // Get public URL for the uploaded file
    const { data: publicUrlData } = this.supabase.storage
      .from(this.defaultBucket)
      .getPublicUrl(filePath);

    console.log('Upload successful:', publicUrlData.publicUrl);

    return {
      url: `${this.supabaseUrl}/storage/v1/object/${this.defaultBucket}/${filePath}`,
      path: filePath,
      publicUrl: publicUrlData.publicUrl,
      fileId,
    };

  } catch (error) {
    console.error('uploadPdf caught error:', error);
    
    if (error instanceof StorageError) {
      throw error;
    }

    throw new StorageError(
      'UPLOAD_FAILED',
      'Failed to upload PDF',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
 
  async downloadFile(fileUrlOrPath: string): Promise<Buffer> {
    try {
      if (!fileUrlOrPath) {
        throw new Error('downloadFile called with null or undefined path');
      }
      console.log('downloadFile called with:', fileUrlOrPath);
      
      let bucket: string;
      let filePath: string;
      console.log("fileUrlOrPath",fileUrlOrPath)
      // Check if it's already a path (no http:// or https://)
      if (!fileUrlOrPath.startsWith('http://') && !fileUrlOrPath.startsWith('https://')) {
        // It's a path, not a URL
        bucket = this.defaultBucket; // Use default bucket
        filePath = fileUrlOrPath;
      } else {
        // It's a URL, parse it
        const parsed = this.parseSupabaseStorageUrl(fileUrlOrPath);
        bucket = parsed.bucket;
        filePath = parsed.filePath;
      }
      
      console.log('Downloading from:', { bucket, filePath });
      
      // Download from Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .download(filePath);
      
      if (error) {
        console.error('Supabase download error:', {
          message: error.message,
          details: error,
        });
        throw new Error(`Failed to download file: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('No data returned from storage');
      }
      
      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
      
    } catch (error) {
      console.error('downloadFile error details:', {
        fileUrlOrPath,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }


  private parseSupabaseStorageUrl(fileUrl: string): { bucket: string; filePath: string } {
    try {
      console.log('Parsing URL:', fileUrl);
      
      // Supabase storage URL pattern:
      // https://project-ref.supabase.co/storage/v1/object/bucket-name/path/to/file
      
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      console.log('Path parts:', pathParts);
      
      // Find the position of 'object' in the path
      const objectIndex = pathParts.indexOf('object');
      if (objectIndex === -1) {
        throw new Error('Invalid Supabase storage URL: "object" not found in path');
      }
      
      // Bucket is the next part after 'object'
      //const bucketIndex = objectIndex + 1;
       const bucketIndex = pathParts[objectIndex + 1] === 'public'
  ? objectIndex + 2
  : objectIndex + 1;
      
      if (bucketIndex >= pathParts.length) {
        throw new Error('Invalid Supabase storage URL: bucket name missing');
      }
      
      const bucket = pathParts[bucketIndex];
      
      // File path is everything after the bucket
      const filePathParts = pathParts.slice(bucketIndex + 1);
      if (filePathParts.length === 0) {
        throw new Error('Invalid Supabase storage URL: file path missing');
      }
      
      const filePath = filePathParts.join('/');
      
      console.log('Parsed result:', { bucket, filePath });
      return { bucket, filePath };
      
    } catch (error) {
      console.error('URL parsing error:', error);
      throw new Error(`Failed to parse storage URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Alternative: Simple regex parsing
  private parseSupabaseStorageUrlRegex(fileUrl: string): { bucket: string; filePath: string } {
    // Pattern: /storage/v1/object/([^/]+)/(.+)$
    const pattern = /\/storage\/v1\/object\/([^/]+)\/(.+)$/;
    const match = fileUrl.match(pattern);
    
    if (!match) {
      throw new Error(`Invalid Supabase storage URL format: ${fileUrl}`);
    }
    
    return {
      bucket: match[1],  // 'letterheads'
      filePath: match[2] // 'previews/system/invoice-test.pdf'
    };
  }
 
 
  async downloadFileDirect(fileUrl: string): Promise<Buffer> {
    try {
      console.log('Attempting direct download from:', fileUrl);
      
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
      
    } catch (error) {
      console.error('Direct download failed:', error);
      throw error;
    }
  }

  async downloadPdf(filePath: string): Promise<{
    buffer: Buffer;
    metadata: {
      contentType: string;
      contentLength: number;
      lastModified: string;
      etag: string;
      cacheControl: string;
    };
  }> {
    try {
      // Download file
      const { data, error } = await this.supabase.storage
        .from(this.defaultBucket)
        .download(filePath);

      if (error) {
        throw new StorageError(
          'DOWNLOAD_FAILED',
          `Failed to download PDF: ${error.message}`,
          error
        );
      }

      // Get file metadata
      const { data: metadata, error: metadataError } = await this.supabase.storage
        .from(this.defaultBucket)
        .list(filePath.split('/').slice(0, -1).join('/'), {
          search: filePath.split('/').pop()!,
        });

      if (metadataError) {
        throw new StorageError(
          'METADATA_FETCH_FAILED',
          `Failed to get file metadata: ${metadataError.message}`,
          metadataError
        );
      }

      const file = metadata?.[0];
      const buffer = Buffer.from(await data.arrayBuffer());

      return {
        buffer,
        metadata: {
          contentType: data.type,
          contentLength: buffer.length,
          lastModified: file?.updated_at || new Date().toISOString(),
          etag: file?.id || '',
          cacheControl: 'public, max-age=3600',
        },
      };

    }
    catch (error) {
  if (error instanceof StorageError) {
    throw error;
  }

  throw new StorageError(
    'DOWNLOAD_FAILED',
    'Failed to download PDF',
    error instanceof Error ? error : new Error(String(error))
  );
}

  }
async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract path from URL
      const path = this.extractFilePath(fileUrl);
      
      const { error } = await this.supabase.storage
        .from(this.defaultBucket)
        .remove([path]);

      if (error) {
        throw new StorageError(
          'DELETE_FAILED',
          `Failed to delete file: ${error.message}`,
          error
        );
      }
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError('DELETE_FAILED', `Failed to delete file: ${fileUrl}`, error as Error);
    }
  }
   private extractFilePath(fileUrl: string): string {
    try {
      const url = new URL(fileUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public\/)?([^?]+)/);
      return pathMatch ? decodeURIComponent(pathMatch[1]) : fileUrl;
    } catch {
      return fileUrl;  
    }
  }
  async deletePdf(filePath: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(this.defaultBucket)
        .remove([filePath]);

      if (error) {
        throw new StorageError(
          'DELETE_FAILED',
          `Failed to delete PDF: ${error.message}`,
          error
        );
      }
    } 
   catch (error) {
  if (error instanceof StorageError) {
    throw error;
  }

  throw new StorageError(
    'DELETE_FAILED',
    'Failed to delete PDF',
    error instanceof Error ? error : new Error(String(error))
  );
}

  }

  // ==========================================
  // Letterhead Operations
  // ==========================================

 
 async uploadLetterhead(
    buffer: Buffer,
    originalFilename: string,
    options?: {
      userId?: string;
      organizationId?: string;
      category?: string;
      metadata?: Record<string, string>;
      mimetype?: string;
    }
  ): Promise<{
    path: string;
    fileId: string;
    dimensions?: { width: number; height: number };
     
  }> {
    try {
      const fileId = uuidv4();
      let extension = extractExtension(originalFilename);
      if (!extension) {
        const detected = await detectExtensionFromBuffer(buffer);
        extension = normalizeExtensionFromBuffer(buffer, detected) || 'png';
      }
      const mimeType = getMimeTypeFromExtension(extension);
      const baseName = stripExtension(originalFilename);
      const safeFilename = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

       
      const filePath = `letterheads/${options?.userId || 'system'}/${fileId}-${safeFilename}.${extension}`;



     

      const { error } = await this.supabase.storage
        .from(this.defaultBucket)
        .upload(filePath, buffer, {
          contentType: mimeType || getMimeType(extension),
          cacheControl: '86400',
          upsert: false,
          metadata: {
            fileId,
            userId: options?.userId || 'system',
            organizationId: options?.organizationId || '',
            category: options?.category || 'general',
            originalFilename,
            uploadedAt: new Date().toISOString(),
            size: buffer.length.toString(),
            ...options?.metadata,
          },
        });
 
      if (error) {
        throw new StorageError('UPLOAD_FAILED', `Failed to upload letterhead: ${error.message}`, error);
      }
      let thumbnailUrl: string | undefined;
 
  
      // Public URL
      const { data: publicUrlData } = this.supabase.storage.from(this.defaultBucket).getPublicUrl(filePath);
  
      // Image dimensions
      let dimensions;
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(extension)) {
        dimensions = await  getImageDimensions(buffer, extension);
      }
      // Return only the path, not a public URL
      return {
        path: filePath,
        fileId,
        dimensions: await  getImageDimensions(buffer, extension),
      };
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        'UPLOAD_FAILED',
        'Failed to upload letterhead',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }


  // ==========================================
  // General File Operations
  // ==========================================

  async generateSignedUrl(
  filePath: string,
  options?: SignedUrlOptions
): Promise<string> {
  try {
    const { data, error } = await this.supabase.storage
      .from(this.defaultBucket)
      .createSignedUrl(filePath, options?.expiresIn || 3600, {
        download: options?.download || false,
      });

    if (error) {
      throw new StorageError(
        'SIGNED_URL_FAILED',
        `Failed to generate signed URL: ${error.message}`,
        error
      );
    }

    return data.signedUrl;
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }

    throw new StorageError(
      'SIGNED_URL_FAILED',
      'Failed to generate signed URL',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}


  async getFileMetadata(filePath: string): Promise<any> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.defaultBucket)
        .list(filePath.split('/').slice(0, -1).join('/'), {
          search: filePath.split('/').pop()!,
        });

      if (error) {
        throw new StorageError(
          'METADATA_FETCH_FAILED',
          `Failed to get file metadata: ${error.message}`,
          error
        );
      }

      return data?.[0] || null;
    }
  catch (error) {
  if (error instanceof StorageError) {
    throw error;
  }

  throw new StorageError(
    'METADATA_FETCH_FAILED',
    'Failed to get file metadata',
    error instanceof Error ? error : new Error(String(error))
  );
}

  }

  async listFiles(
    folder: string,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: 'name' | 'updated_at' | 'size';
      sortOrder?: 'asc' | 'desc';
      search?: string;
    }
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.defaultBucket)
        .list(folder, {
          limit: options?.limit || 100,
          offset: options?.offset || 0,
          sortBy: {
            column: options?.sortBy || 'updated_at',
            order: options?.sortOrder || 'desc',
          },
          search: options?.search,
        });

      if (error) {
        throw new StorageError(
          'LIST_FAILED',
          `Failed to list files: ${error.message}`,
          error
        );
      }

      return data || [];
    }
    catch (error) {
  if (error instanceof StorageError) {
    throw error;
  }

  throw new StorageError(
    'LIST_FAILED',
    'Failed to list files',
    error instanceof Error ? error : new Error(String(error))
  );
}

  }

  async cleanupExpiredPreviews(expirationHours: number = 24): Promise<number> {
    try {
      const previewsFolder = 'previews';
      const { data: files, error } = await this.supabase.storage
        .from(this.defaultBucket)
        .list(previewsFolder, {
          limit: 1000,
        });

      if (error) {
        throw new StorageError(
          'CLEANUP_FAILED',
          `Failed to list previews: ${error.message}`,
          error
        );
      }

      const now = new Date();
      const expiredFiles = files.filter(file => {
        const createdAt = new Date(file.created_at || file.updated_at);
        const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        return hoursDiff > expirationHours;
      });

      if (expiredFiles.length === 0) {
        return 0;
      }

      const filePaths = expiredFiles.map(file => 
        `${previewsFolder}/${file.name}`
      );

      const { error: deleteError } = await this.supabase.storage
        .from(this.defaultBucket)
        .remove(filePaths);

      if (deleteError) {
        throw new StorageError(
          'CLEANUP_FAILED',
          `Failed to delete expired previews: ${deleteError.message}`,
          deleteError
        );
      }

      return expiredFiles.length;

    } 
  catch (error) {
  if (error instanceof StorageError) {
    throw error;
  }

  throw new StorageError(
    'CLEANUP_FAILED',
    'Failed to cleanup expired previews',
    error instanceof Error ? error : new Error(String(error))
  );
}

  }

  // ==========================================
  // Helper Methods
  // ==========================================



  async generateThumbnail(
    buffer: Buffer,
    options: {
      width: number;
      height: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    },
    mimeType: string,
    fileId: string,
    extension: string,
  ): Promise<{
    path: string | null;
    buffer: Buffer | null;
    error?: Error;
  }> {
    try {
      console.log("=== generateThumbnail START ===");
      console.log("Input parameters:", {
        fileId,
        extension,
        mimeType,
        options,
        bufferSize: buffer.length
      });
  
      // First, check if file type supports thumbnails
      const supportedImageTypes = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'heic', 'heif', 'svg'];
      const supportedDocumentTypes = ['pdf'];
  
      // Clean the extension - remove any weird characters
      const cleanExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, '');
      console.log("Clean extension:", cleanExtension);
  
      // Check if thumbnail generation is supported
      const isImage = supportedImageTypes.includes(cleanExtension);
      const isPdf = supportedDocumentTypes.includes(cleanExtension);
      const isImageByMime = mimeType.startsWith('image/');
      const isPdfByMime = mimeType === 'application/pdf';
  
      console.log("Support check:", {
        isImage,
        isPdf,
        isImageByMime,
        isPdfByMime
      });
  
      if (!isImage && !isPdf && !isImageByMime && !isPdfByMime) {
        console.log(`Thumbnail generation not supported for:`, {
          extension: cleanExtension,
          mimeType
        });
        return {
          path: null,
          buffer: null,
          
        };
      }
  
      console.log("File type supported, generating thumbnail...");
  
      // Generate thumbnail buffer using ThumbnailGenerator
      const thumbnailBuffer = await this.thumbnailGenerator.generateThumbnail(
        buffer,
        {
          width: options.width || 300,
          height: options.height || 300,
          format: options.format || 'webp',
          quality: options.quality || 85
        }
      );
  
      console.log("Thumbnail buffer generated:", {
        size: thumbnailBuffer.length,
        firstBytes: thumbnailBuffer.slice(0, 20).toString('hex')
      });
  
      // Create unique thumbnail path
      const thumbnailFormat = options.format || 'webp';
      const thumbnailPath = `thumbnails/${fileId}_${options.width || 300}x${options.height || 300}.${thumbnailFormat}`;
      
      console.log("Thumbnail path:", thumbnailPath);
      console.log("Uploading to bucket:", this.defaultBucket);
      console.log("Full storage path:", `${this.defaultBucket}/${thumbnailPath}`);
  
      // Upload to Supabase storage
      const { error: uploadError } = await this.supabase.storage
        .from(this.defaultBucket)
        .upload(thumbnailPath, thumbnailBuffer, {
          contentType: `image/${thumbnailFormat}`,
          upsert: true
        });
        if (uploadError) {
          console.error("Thumbnail upload failed:", uploadError);
          console.error("Upload error details:", {
            message: uploadError.message,
            status: uploadError.cause,
            statusCode: uploadError.name
          });
          
          // Return buffer even if upload fails
          return {
            path: null,
            buffer: thumbnailBuffer,
            error: uploadError
          };
        }
    
  
      console.log("=== generateThumbnail SUCCESS ===");
      console.log("Thumbnail uploaded to:", thumbnailPath);
      
      // Verify the thumbnail exists
      await this.verifyThumbnailExists(thumbnailPath);
      
      return {
        path: thumbnailPath,
        buffer: thumbnailBuffer
      };
  
    } catch (error) {
      console.error('=== generateThumbnail ERROR ===');
      console.error('Failed to generate thumbnail:', error);
      // Don't throw - return null so main upload can continue
      return {
        path: null,
        buffer: null,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  // Add this helper method to verify thumbnail exists
  private async verifyThumbnailExists(thumbnailPath: string): Promise<void> {
    try {
      console.log("Verifying thumbnail exists...");
      
      // Try to get the public URL
      const { data } = this.supabase.storage
        .from(this.defaultBucket)
        .getPublicUrl(thumbnailPath);
      
      console.log("Thumbnail public URL:", data.publicUrl);
      
      // Try to list files in thumbnails folder
      const { data: files, error } = await this.supabase.storage
        .from(this.defaultBucket)
        .list('thumbnails', {
          limit: 10
        });
      
      if (error) {
        console.error("Failed to list thumbnails:", error);
      } else {
        console.log("Files in thumbnails folder:", files?.map(f => f.name));
      }
      
    } catch (error) {
      console.error("Failed to verify thumbnail:", error);
    }
  }
   
  async extractImageDimensions(
    buffer: Buffer, 
    mimetype: string
  ): Promise<{ width: number; height: number; dpi?: number }> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    try {
      console.log(`[${requestId}] extractImageDimensions called`, {
        mimetype,
        bufferLength: buffer.length,
        bufferIsValid: Buffer.isBuffer(buffer),
        firstBytes: buffer.length > 0 ? buffer.slice(0, 10).toString('hex') : 'empty'
      });
  
       
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        console.error(`[${requestId}] Invalid buffer provided`, {
          bufferType: typeof buffer,
          bufferLength: buffer?.length
        });
        throw new Error('Invalid or empty buffer provided');
      }
  
      
      if (mimetype === 'application/pdf') {
        console.log(`[${requestId}] Processing PDF file`);
        return this.imageProcessor.handlePdfDimensions(buffer, requestId);
      }
  
      if (mimetype === 'image/svg+xml') {
        console.log(`[${requestId}] Processing SVG file`);
        return this.imageProcessor.handleSvgDimensions(buffer, requestId);
      }
  
      
      console.log(`[${requestId}] Processing image with sharp`);
      
     
      let sharp;
      try {
        sharp = await import('sharp');
        console.log(`[${requestId}] Sharp imported successfully`);
      } catch (importError) {
        console.error(`[${requestId}] Failed to import sharp:`, importError);
        throw new Error('Sharp library not available');
      }
  
      // Validate sharp instance
      if (!sharp || !sharp.default) {
        console.error(`[${requestId}] Sharp import returned invalid object`);
        throw new Error('Sharp library initialization failed');
      }
  
      // Create sharp instance
      let image;
      try {
        image = sharp.default(buffer);
        console.log(`[${requestId}] Sharp instance created`);
      } catch (sharpError) {
        const errorMessage =
          sharpError instanceof Error ? sharpError.message : String(sharpError);
        console.error(`[${requestId}] Failed to create sharp instance:`, {
          error: errorMessage,
          mimetype,
          bufferLength: buffer.length
        });
        // Try to get basic info without sharp
        return this.imageProcessor.getBasicImageInfo(buffer, mimetype, requestId);
      }
  
      
      let metadata;
      try {
        metadata = await image.metadata();
        console.log(`[${requestId}] Metadata extracted:`, {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: metadata.size,
          density: metadata.density,
          hasAlpha: metadata.hasAlpha,
          space: metadata.space
        });
      } catch (metadataError) {
        const errorMessage = metadataError instanceof Error ? metadataError.message : String(metadataError);
        console.error(`[${requestId}] Failed to extract metadata:`, {
          error: errorMessage,
          mimetype
        });
        
      
        return this.imageProcessor.getBasicImageInfo(buffer, mimetype, requestId);
      }
  
      
      if (!metadata || (!metadata.width && !metadata.height)) {
        console.warn(`[${requestId}] Metadata missing dimensions`, metadata);
        
        // Try alternative approach
        try {
          const stats = await image.stats();
          console.log(`[${requestId}] Image stats:`, {
            channels: stats.channels,
            isOpaque: stats.isOpaque
          });
        } catch (statsError) {
          const errorMessage =
            statsError instanceof Error ? statsError.message : String(statsError);
          console.warn(`[${requestId}] Could not get image stats:`, errorMessage);
        }
        
        return this.imageProcessor.getBasicImageInfo(buffer, mimetype, requestId);
      }
  
      const result = {
        width: metadata.width || 0,
        height: metadata.height || 0,
        dpi: metadata.density || undefined
      };
  
      console.log(`[${requestId}] Dimension extraction successful`, {
        ...result,
        processingTime: Date.now() - startTime + 'ms'
      });
  
      return result;
  
    } catch (error) {
      console.error(`[${requestId}] extractImageDimensions failed:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        mimetype,
        processingTime: Date.now() - startTime + 'ms'
      });
      
      // Ultimate fallback
      return {
        width: 0,
        height: 0,
        dpi: undefined
      };
    }
  }
  
 
  
 
  // ==========================================
  // Health Check & Bucket Management
  // ==========================================

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    bucketExists: boolean;
    writeable: boolean;
    timestamp: string;
  }> {
    try {
      // Test bucket existence
      const { data: buckets, error: _listError } = await this.supabase.storage
        .listBuckets();

      const bucketExists = buckets?.some(b => b.name === this.defaultBucket) || false;

      // Test write capability
      let writeable = false;
      if (bucketExists) {
        const testData = Buffer.from('health-check');
        const testPath = `health-check-${Date.now()}.txt`;
        
        const { error: uploadError } = await this.supabase.storage
          .from(this.defaultBucket)
          .upload(testPath, testData, {
            contentType: 'text/plain',
            cacheControl: '0',
          });

        if (!uploadError) {
          writeable = true;
          // Clean up test file
          await this.supabase.storage
            .from(this.defaultBucket)
            .remove([testPath]);
        }
      }

      return {
        status: bucketExists && writeable ? 'healthy' : 'unhealthy',
        bucketExists,
        writeable,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        bucketExists: false,
        writeable: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

async ensureBuckets(): Promise<void> {
    try {
      const requiredBuckets = [
        this.defaultBucket,
        'letterheads',
        'thumbnails',
        'previews',
      ];

      for (const bucketName of requiredBuckets) {
        const { data: buckets } = await this.supabase.storage.listBuckets();
        const exists = buckets?.some(b => b.name === bucketName);

        if (!exists) {
          // Create PRIVATE buckets
          const { error } = await this.supabase.storage.createBucket(bucketName, {
            public: false,  
            fileSizeLimit: 50 * 1024 * 1024,  
            allowedMimeTypes: [
              'application/pdf',
              'image/*',
              'application/json',
              'text/plain',
              'image/svg+xml',  
            ],
          });

          if (error && error.message !== 'Bucket already exists') {
            throw new StorageError(
              'BUCKET_CREATION_FAILED',
              `Failed to create bucket ${bucketName}: ${error.message}`,
              error
            );
          }
        } else {
          // Update existing bucket to private if needed
          const { error } = await this.supabase.storage.updateBucket(bucketName, {
            public: false,
          });
          
          if (error) {
            console.warn(`Failed to update bucket ${bucketName} to private:`, error.message);
          }
        }
      }
    } catch (error) {
      throw new StorageError(
        'BUCKET_SETUP_FAILED',
        'Failed to ensure buckets exist',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

   async getSecureFileUrl(
    filePath: string,
    options?: {
      expiresIn?: number;
      download?: boolean;
      downloadName?: string;
    }
  ): Promise<{
    signedUrl: string;
    expiresAt: Date;
    publicUrl?: string; // Only for truly public files
  }> {
    try {
      const expiresIn = options?.expiresIn || 3600; 
      
      const { data, error } = await this.supabase.storage
        .from(this.defaultBucket)
        .createSignedUrl(filePath, expiresIn, {
          download: options?.download || false,
        });

      if (error) {
        throw new StorageError(
          'SIGNED_URL_FAILED',
          `Failed to generate signed URL: ${error.message}`,
          error
        );
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      return {
        signedUrl: data.signedUrl,
        expiresAt,
      };
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        'SIGNED_URL_FAILED',
        'Failed to generate signed URL',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }



  async getSingleFile(filePath: string): Promise<DownloadFileResult> {
    try {
      // Download file from Supabase
      const { data, error } = await this.supabase.storage
      .from(this.defaultBucket)
        .download(filePath);

      if (error) {
        throw new StorageError(
          'DOWNLOAD_FAILED',
          `Failed to download file: ${filePath}`,
          error
        );
      }

      if (!data) {
        throw new StorageError(
          'FILE_NOT_FOUND',
          `File not found: ${filePath}`
        );
      }

      // Convert Blob/File to Buffer
      const buffer = await  blobToBuffer(data);
      
      // Get MIME type
      const mimeType = data.type || 'application/octet-stream';

      return {
        buffer,
        mimeType,
        size: buffer.length,
      };
    } catch (error) {
      throw new StorageError(
        'DOWNLOAD_FAILED',
        `Failed to download file: ${filePath}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

//   //testing:
//   // Add this method to your SupabaseStorageService class
// async debugStorage(): Promise<{
//   status: 'success' | 'error';
//   details: any;
// }> {
//   try {
//     console.log('=== 🛠️ STORAGE DEBUG START ===');
    
//     const debugInfo: any = {
//       timestamp: new Date().toISOString(),
//       serviceConfig: {
//         defaultBucket: this.defaultBucket,
//         supabaseUrl: this.supabaseUrl,
//         serviceRoleKey: this._serviceRoleKey ? '***' + this._serviceRoleKey.slice(-4) : 'not set',
//       },
//       buckets: [],
//       files: {},
//       health: {},
//       errors: []
//     };

//     // 1. List all available buckets
//     console.log('🔍 Listing all buckets...');
//     const { data: buckets, error: bucketsError } = await this.supabase.storage.listBuckets();
    
//     if (bucketsError) {
//       debugInfo.errors.push({ type: 'LIST_BUCKETS', error: bucketsError.message });
//       console.error('❌ Failed to list buckets:', bucketsError);
//     } else {
//       debugInfo.buckets = buckets?.map(b => ({
//         name: b.name,
//         id: b.id,
//         public: b.public,
//         fileSizeLimit: b.file_size_limit,
//         allowedMimeTypes: b.allowed_mime_types
//       }));
//       console.log(`✅ Found ${buckets?.length || 0} buckets:`, debugInfo.buckets.map((b: any) => b.name));
//     }

//     // 2. Check health of the default bucket
//     console.log(`🔍 Checking health of bucket '${this.defaultBucket}'...`);
//     debugInfo.health.defaultBucket = await this.checkBucketHealth(this.defaultBucket);

//     // 3. List specific folders
//     const foldersToCheck = [
//       'thumbnails',
//       'letterheads',
//       'letterheads/13a90f21-2238-4ed9-8a9d-f2ab3cca3d96'
//     ];

//     for (const folder of foldersToCheck) {
//       console.log(`🔍 Listing files in '${folder}'...`);
//       const { data: files, error: listError } = await this.supabase.storage
//         .from(this.defaultBucket)
//         .list(folder, { limit: 50 });

//       if (listError) {
//         debugInfo.errors.push({ type: `LIST_${folder.toUpperCase()}`, error: listError.message });
//         console.log(`⚠️  Could not list '${folder}':`, listError.message);
//       } else {
//         debugInfo.files[folder] = files?.map(f => ({
//           name: f.name,
//           size: f.metadata?.size,
//           mimetype: f.metadata?.mimetype,
//           created: f.created_at,
//           updated: f.updated_at,
//           id: f.id
//         }));
//         console.log(`📁 Found ${files?.length || 0} files in '${folder}'`);
//       }
//     }

//     // 4. Test specific problematic files
//     const testFiles = [
//       'thumbnails/7642d977-0297-4181-a264-61e8c0b50e07_300x300.jpeg',
//       'letterheads/13a90f21-2238-4ed9-8a9d-f2ab3cca3d96/efcb07c8-b6de-4444-a59d-2379471eceaf-update_1767725620094_letterhead_1767725618404.jpg'
//     ];

//     debugInfo.fileTests = [];
    
//     for (const filePath of testFiles) {
//       console.log(`🔍 Testing file existence: '${filePath}'...`);
//       const testResult = await this.testFileExistence(filePath);
//       debugInfo.fileTests.push(testResult);
      
//       if (testResult.exists) {
//         console.log(`✅ File exists: ${filePath} (${testResult.size} bytes)`);
//       } else {
//         console.log(`❌ File does not exist: ${filePath}`);
//       }
//     }

//     // 5. Check permissions
//     console.log('🔍 Checking bucket permissions...');
//     const { data: bucketInfo, error: bucketInfoError } = await this.supabase.storage
//       .getBucket(this.defaultBucket);
    
//     if (!bucketInfoError) {
//       debugInfo.bucketPermissions = {
//         public: bucketInfo.public,
//         fileSizeLimit: bucketInfo.file_size_limit,
//         allowedMimeTypes: bucketInfo.allowed_mime_types
//       };
//       console.log(`📊 Bucket permissions:`, debugInfo.bucketPermissions);
//     }

//     // 6. Try to upload a small test file
//     console.log('🔍 Testing upload capability...');
//     const testUpload = await this.testUpload();
//     debugInfo.uploadTest = testUpload;

//     console.log('=== 🛠️ STORAGE DEBUG END ===');
    
//     return {
//       status: 'success',
//       details: debugInfo
//     };

//   } catch (error) {
//     console.error('💥 Storage debug failed:', error);
//     return {
//       status: 'error',
//       details: {
//         error: error instanceof Error ? error.message : 'Unknown error',
//         timestamp: new Date().toISOString()
//       }
//     };
//   }
// }

// // Helper methods for the debug function:

// private async checkBucketHealth(bucketName: string): Promise<any> {
//   try {
//     // Try to list a few files
//     const { data, error } = await this.supabase.storage
//       .from(bucketName)
//       .list('', { limit: 1 });

//     if (error) {
//       return {
//         status: 'unhealthy',
//         error: error.message,
//         canList: false
//       };
//     }

//     // Try to get bucket info
//     const { data: bucketInfo, error: bucketError } = await this.supabase.storage
//       .getBucket(bucketName);

//     return {
//       status: 'healthy',
//       canList: true,
//       bucketExists: !bucketError,
//       public: bucketInfo?.public || false,
//       fileCount: data?.length || 0
//     };
//   } catch (error) {
//     return {
//       status: 'error',
//       error: error instanceof Error ? error.message : 'Unknown error'
//     };
//   }
// }

// private async testFileExistence(filePath: string): Promise<{
//   path: string;
//   exists: boolean;
//   size?: number;
//   error?: string;
//   publicUrl?: string;
// }> {
//   try {
//     // First, try to get metadata
//     const parentDir = filePath.split('/').slice(0, -1).join('/') || '';
//     const fileName = filePath.split('/').pop()!;
    
//     const { data: files, error } = await this.supabase.storage
//       .from(this.defaultBucket)
//       .list(parentDir, { search: fileName });

//     if (error) {
//       return {
//         path: filePath,
//         exists: false,
//         error: error.message
//       };
//     }

//     const fileExists = files?.some(f => f.name === fileName);
    
//     if (!fileExists) {
//       return {
//         path: filePath,
//         exists: false,
//         error: 'File not found in listing'
//       };
//     }

//     const file = files!.find(f => f.name === fileName);
    
//     // Try to get public URL
//     const { data: urlData } = this.supabase.storage
//       .from(this.defaultBucket)
//       .getPublicUrl(filePath);

//     return {
//       path: filePath,
//       exists: true,
//       size: parseInt(file?.metadata?.size || '0'),
//       publicUrl: urlData?.publicUrl
//     };
//   } catch (error) {
//     return {
//       path: filePath,
//       exists: false,
//       error: error instanceof Error ? error.message : 'Unknown error'
//     };
//   }
// }

// private async testUpload(): Promise<{
//   success: boolean;
//   filePath?: string;
//   error?: string;
//   duration?: number;
// }> {
//   const startTime = Date.now();
  
//   try {
//     // Create a small test file
//     const testContent = `Storage test ${new Date().toISOString()}`;
//     const testBuffer = Buffer.from(testContent, 'utf-8');
//     const testFileName = `test-${Date.now()}.txt`;
//     const testPath = `debug/${testFileName}`;

//     console.log(`📤 Testing upload to ${testPath}...`);
    
//     const { error } = await this.supabase.storage
//       .from(this.defaultBucket)
//       .upload(testPath, testBuffer, {
//         contentType: 'text/plain',
//         upsert: true
//       });

//     const duration = Date.now() - startTime;

//     if (error) {
//       return {
//         success: false,
//         error: error.message,
//         duration
//       };
//     }

//     // Try to download it back
//     const { data: downloadedData } = await this.supabase.storage
//       .from(this.defaultBucket)
//       .download(testPath);

//     // Clean up
//     await this.supabase.storage
//       .from(this.defaultBucket)
//       .remove([testPath]);

//     return {
//       success: true,
//       filePath: testPath,
//       duration,
//       // downloadedSize is not part of the return type, but can be included in filePath as debug info if needed.
//       // If needed elsewhere, update the return type! For now, we omit it for type safety.
//     };
//   } catch (error) {
//     return {
//       success: false,
//       error: error instanceof Error ? error.message : 'Unknown error',
//       duration: Date.now() - startTime
//     };
//   }
// }

// // Also add a quick debug method for specific paths
// async debugPath(filePath: string): Promise<{
//   exists: boolean;
//   details: any;
//   alternatives?: string[];
// }> {
//   console.log(`🔍 Debugging path: ${filePath}`);
  
//   const result = await this.testFileExistence(filePath);
  
//   if (!result.exists) {
//     // Try alternative paths
//     const alternatives = await this.findSimilarFiles(filePath);
    
//     return {
//       exists: false,
//       details: result,
//       alternatives
//     };
//   }
  
//   return {
//     exists: true,
//     details: result
//   };
// }

// private async findSimilarFiles(filePath: string): Promise<string[]> {
//   const fileName = filePath.split('/').pop()!;
//   const similarFiles: string[] = [];
  
//   try {
//     // Search in different folders
//     const searchFolders = ['thumbnails', 'letterheads', ''];
    
//     for (const folder of searchFolders) {
//       const { data: files } = await this.supabase.storage
//         .from(this.defaultBucket)
//         .list(folder, { limit: 100 });
      
//       const matches = files?.filter(f => 
//         f.name.includes(fileName.split('_')[0]) || // Match by fileId
//         f.name.includes(fileName.split('.')[0])    // Match by name without extension
//       ).map(f => `${folder ? folder + '/' : ''}${f.name}`) || [];
      
//       similarFiles.push(...matches);
//     }
//   } catch (error) {
//     console.log('Error finding similar files:', error);
//   }
  
//   return similarFiles;
// }














}