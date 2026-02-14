 
 import { IStorageService } from "@application/interfaces/storage-service.js";
import {   LetterheadType } from "@prisma/client";
 import {
  LetterheadRepository,
  CreateLetterheadData as RepositoryCreateLetterheadData,
  LetterheadFilters,
 
} from "@application/interfaces/letterhead-repository.interface.js";
import { LetterheadDuplicateError, LetterheadError, LetterheadNotFoundError, LetterheadValidationError } from "@domain/errors/letterhead-error.js";
import { ILogger } from "@infrastructure/logger/logger.js";
import { IConfig, IImageProcessor } from "@application/dto/letterhead.dto.js";
import { Letterhead } from "@domain/entities/letterhead.entity.js";
import { detectExtensionFromBuffer, detectExtensionFromBufferOptimized, normalizeExtensionFromBuffer, stripExtension } from "@shared/utils/extensionUtil.js";
import { getBufferFromSupabasePath } from "@shared/utils/common.js";
import { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { validateLetterHeadAccess } from "@shared/letterhead/lettherhead.js";
import { v4 as uuidv4 } from 'uuid';
export class CloneLetterheadUseCase {
  constructor(
    private readonly letterheadRepository: LetterheadRepository,
    private readonly storageService: IStorageService,
    private readonly supabase: SupabaseClient,
    private readonly logger: ILogger,
    private readonly config: IConfig
  ) {}

  private generateRequestId(): string {
    return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  async execute(
    userId: string,
    sourceLetterheadId: string,
    data: {
      newName: string;
      description?: string;
      isActive?: boolean;
      isPublic?: boolean;
      organizationId?: string | null;
    }
  ): Promise<Letterhead> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      if (!data.newName || data.newName.trim().length === 0) {
        throw new LetterheadValidationError('INVALID_INPUT', [
          'New name is required for cloning',
        ]);
      }
      this.logger.info('Starting letterhead clone', {
        requestId,
        userId,
        sourceLetterheadId,
        newName: data.newName,
      });

      // 1. Get source letterhead
      const sourceLetterhead = await this.letterheadRepository.findById(sourceLetterheadId);
      if (!sourceLetterhead) {
        throw new LetterheadNotFoundError(sourceLetterheadId);
      }

      // 2. Validate access to source letterhead
      if (!sourceLetterhead.isPublic && sourceLetterhead.userId !== userId) {
        throw new LetterheadError('ACCESS_DENIED', 'You do not have permission to clone this letterhead');
      }
      validateLetterHeadAccess(sourceLetterhead, userId, null); 
      // 3. Check for duplicates with new name
      await this.checkForDuplicates(
        data.newName,
        userId,
        data.organizationId || sourceLetterhead.organizationId
      );

      // 4. Copy the actual file in storage
      let newFilePath: string;
      let newThumbnailPath: string | undefined;
      
      try {
        // Download source file
        const sourceFileBuffer = await this.storageService.downloadFile(sourceLetterhead.filePath!);

          
        const timestamp = Date.now();
        
        const baseName = `clone_${timestamp}_${sourceLetterhead.name.replace(/[^a-zA-Z0-9]/g, '_')}`;


         console.log("sourceFileBuffer",sourceFileBuffer)
        // Upload as new file with unique name
        const detectedExt =
        await detectExtensionFromBufferOptimized(sourceFileBuffer);
      
      const extension =
        normalizeExtensionFromBuffer(sourceFileBuffer, detectedExt);

     
        const newFilename = `${baseName}.${extension}`;


 
 
 
        const uploadResult = await this.storageService.uploadLetterhead(
          sourceFileBuffer,
          newFilename,
          {
            userId,
            organizationId: data.organizationId || sourceLetterhead.organizationId || undefined,
            mimetype: sourceLetterhead.mimeType,
          }
        );
        
        newFilePath = uploadResult.path;
        
        // Copy thumbnail if exists
   // In CloneLetterheadUseCase.execute method:
// Copy thumbnail if exists
           // In CloneLetterheadUseCase:
if (sourceLetterhead.thumbnailPath) {
  try {
    const thumbnailBuffer = await this.storageService.downloadFile(sourceLetterhead.thumbnailPath);
    
    // Get fileId from source path or generate new one
    const thumbFileId = `clone_${uuidv4()}`;
    const thumbExtension = 'jpeg'; // Thumbnails are always jpeg
    
    console.log('Cloning thumbnail with generateThumbnail:', {
      thumbFileId,
      bufferSize: thumbnailBuffer.length
    });
    
    // Use generateThumbnail - it will upload to thumbnails folder
    const thumbData = await this.storageService.generateThumbnail(
      thumbnailBuffer,
      { 
        width: 300, 
        height: 300, 
        quality: 85, 
        format: 'jpeg' as 'jpeg'
      },
      'image/jpeg', // Thumbnails are always jpeg
      thumbFileId,
      thumbExtension
    );
    
    if (thumbData?.path) {
      newThumbnailPath = thumbData.path;
      console.log('Thumbnail cloned to:', newThumbnailPath);
    } else {
      console.warn('generateThumbnail did not return a path');
    }
    
  } catch (thumbError) {
    console.error('Failed to clone thumbnail:', thumbError);
    // Continue without thumbnail
  }
}
      } catch (storageError) {
        throw new LetterheadError(
          'STORAGE_COPY_FAILED',
          'Failed to copy letterhead file in storage',
          storageError instanceof Error ? storageError : new Error(String(storageError))
        );
      }

      // 5. Create new letterhead record
      const letterheadData: RepositoryCreateLetterheadData = {
        name: data.newName,
        description: data.description || sourceLetterhead.description,
        category: sourceLetterhead.category,
        
        // File data - NEW paths
        filePath: newFilePath,
        thumbnailPath: newThumbnailPath,
        fileSize: sourceLetterhead.fileSize,
        fileType: sourceLetterhead.fileType,
        mimeType: sourceLetterhead.mimeType,
        width: sourceLetterhead.width,
        height: sourceLetterhead.height,
        dpi: sourceLetterhead.dpi,
        
        // Styling and formatting
        backgroundColor: sourceLetterhead.backgroundColor,
        opacity: sourceLetterhead.opacity,
        marginSafeZone: sourceLetterhead.marginSafeZone,
        
        // Layout and dimensions
        paperSize: sourceLetterhead.paperSize,
        orientation: sourceLetterhead.orientation,
        margins: sourceLetterhead.margins || {
          top: 57.6, right: 18, bottom: 36, left: 18
        },
        safeZones: sourceLetterhead.safeZones || {
          header: { top: 72, bottom: 144, left: 36, right: 36 },
          footer: { top: 648, bottom: 36, left: 36, right: 36 }
        },
        brandColors: sourceLetterhead.brandColors || [],
        primaryFont: sourceLetterhead.primaryFont,
        secondaryFont: sourceLetterhead.secondaryFont,
        dimensionsUnit: sourceLetterhead.dimensionsUnit,
        colorProfile: sourceLetterhead.colorProfile,
        hasBleedArea: sourceLetterhead.hasBleedArea,
        bleedAreaSize: sourceLetterhead.bleedAreaSize,
        
        // Status and metadata
        isActive: data.isActive !== undefined ? data.isActive : sourceLetterhead.isActive,
        isPublic: data.isPublic !== undefined ? data.isPublic : sourceLetterhead.isPublic,
        isSystem: false,
        usageCount: 0,
        
        // Ownership
        userId,
        organizationId: data.organizationId || sourceLetterhead.organizationId,
        parentId: sourceLetterheadId, // Track the source for versioning
        
        // Timestamps
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: undefined,
        
        // Versioning
        version: sourceLetterhead.version,
      };

      const clonedLetterhead = await this.letterheadRepository.create(letterheadData);

      // 6. Increment usage count of source letterhead (optional)
      try {
        await this.letterheadRepository.incrementUsageCount(sourceLetterheadId);
      } catch (error) {
        // Non-critical, just log
        this.logger.warn('Failed to increment source letterhead usage', {
          requestId,
          sourceLetterheadId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      this.logger.info('Letterhead cloned successfully', {
        requestId,
        sourceLetterheadId,
        clonedLetterheadId: clonedLetterhead.id,
        userId,
        duration: Date.now() - startTime,
      });

      return clonedLetterhead;

    } catch (error) {
      console.log("error",error)
      this.logger.error('Failed to clone letterhead', {
        requestId,
        userId,
        sourceLetterheadId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });

      if (
        error instanceof LetterheadValidationError ||
        error instanceof LetterheadDuplicateError ||
        error instanceof LetterheadError
      ) {
        throw error;
      }

      throw new LetterheadError(
        'CLONE_FAILED',
        'Failed to clone letterhead',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async checkForDuplicates(
    name: string,
    userId: string,
    organizationId?: string | null
  ): Promise<void> {
    const existing = await this.letterheadRepository.findByName(
      name,
      userId,
      organizationId || null
    );

    if (existing && !existing.deletedAt) {
      throw new LetterheadDuplicateError(name, userId, organizationId);
    }
  }

  private mapStringToLetterheadType(fileType: string): LetterheadType {
    if (fileType === 'PDF' || fileType === 'IMAGE' || fileType === 'SVG') {
      return fileType as LetterheadType;
    }
    return 'IMAGE';
  }

 

  private async   generateAndSaveThumbnail(
  supabase: any,
  bucket: string,
  fileBuffer: Buffer,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  },
  fileId: string
): Promise<{ path: string; buffer: Buffer }> {
  const width = options.width || 300;
  const height = options.height || 300;
  const quality = options.quality || 85;
  const format = options.format || 'jpeg';

  // Generate thumbnail buffer using sharp
  const thumbnailBuffer = await sharp(fileBuffer)
    .resize(width, height, { fit: 'inside' })
    [format]({ quality })
    .toBuffer();

  // Create unique storage path
  const thumbnailPath = `thumbnails/${fileId}_${width}x${height}.${format}`;

  // Upload to Supabase
  const { error } = await supabase.storage.from(bucket).upload(
    thumbnailPath,
    thumbnailBuffer,
    {
      contentType: `image/${format}`,
      upsert: true,
    }
  );

  if (error) {
    throw new Error(`Thumbnail upload failed: ${error.message}`);
  }

  return { path: thumbnailPath, buffer: thumbnailBuffer };
}

}