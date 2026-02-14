import { CreateLetterheadData, CreateLetterheadInput, IConfig, IImageProcessor,  LetterheadFile } from "@application/dto/letterhead.dto.js";
 import { IStorageService } from "@application/interfaces/storage-service.js";
import { LetterheadDuplicateError, LetterheadError, LetterheadValidationError } from "@domain/errors/letterhead-error.js";
import { Letterhead, LetterheadType, Prisma } from "@prisma/client";

 import {
  LetterheadRepository,
  CreateLetterheadData as RepositoryCreateLetterheadData,
  LetterheadFilters,
 
} from "@application/interfaces/letterhead-repository.interface.js";
import { ILogger } from "@infrastructure/logger/logger.js";
import { MarginSafeZone } from "@domain/entities/letterhead.entity.js";
import { calculateMarginSafeZone, determineFileType, generateRequestId, isImageFile, isPdfFile, mapStringToLetterheadType, MAX_DIMENSION, MIN_DIMENSION, validateFile } from "@shared/letterhead/lettherhead.js";
import { validateCreateData } from "@shared/utils/validateData.js";
import { v4 as uuidv4 } from 'uuid';
import { detectExtensionFromBufferOptimized, getFileExtension, mimeTypeToExtension, normalizeExtensionFromBuffer } from "@shared/utils/extensionUtil.js";

interface ProcessedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  size: number;
  dimensions?: { width: number; height: number };
  dpi?: number;
  thumbnailBuffer?: Buffer;
  thumbnailPath?: string;
}

export class CreateLetterheadUseCase {
  constructor(
    private readonly letterheadRepository: LetterheadRepository,
    private readonly storageService: IStorageService,
    private readonly imageProcessor: IImageProcessor,
    private readonly logger: ILogger,
    private readonly config: IConfig
  ) {}

  async execute(
    userId: string,
    data: CreateLetterheadData | (CreateLetterheadData & { sourceLetterheadId: string }),
    file?: LetterheadFile | null
  ): Promise<Letterhead> {

    
    const startTime = Date.now();
    const requestId =  generateRequestId();
    let thumbnailPath: string | undefined;

    try {
     
      this.logger.info('Starting letterhead operation', {
        requestId,
        userId,
        operation: file ? 'upload' : 'clone',
        filename: file?.filename,
        fileSize: file?.size,
      });
  
      // 1. Validate input data
       validateCreateData(data);
  
      // 2. Check for duplicates
      await this.checkForDuplicates(data.name, userId, data.organizationId);
  
      // Handle file upload vs clone
      let filePath: string | null = null;  
      let thumbnailPath: string | null = null;  
      let fileSize = 0;
      let fileType: LetterheadType = 'IMAGE';
      let mimeType = 'image/jpeg';
      let width: number | null = null;
      let height: number | null = null;
      let dimensions: { width: number; height: number } | undefined;
      let dpi: number | null = this.config.defaultDpi || 300;
       
      if (file) {
        // 3. File upload flow
         validateFile(file,this.config.maxFileSize);
        const processedFile = await this.processUploadedFile(file, requestId);
      

        console.log("processedFile",processedFile)
        // Upload to storage - returns path, not URL
        const uploadResult = await this.storageService.uploadLetterhead(
          processedFile.buffer,
          processedFile.filename,
          {
            userId,
            organizationId: data.organizationId || undefined,
            metadata: {
              originalFilename: file.filename,
              requestId,
              timestamp: new Date().toISOString(),
            },
            mimetype: processedFile.mimetype,
          }
        );
  
        // Store the path, not URL
        filePath = uploadResult.path;  
        
        
        // Handle thumbnail
        if (processedFile.thumbnailBuffer) {
          try {
            
            thumbnailPath = processedFile.thumbnailPath!; // Use path, not url
          } catch (error) {
            this.logger.warn('Failed to upload thumbnail', { requestId });
          }
        }
  
        fileSize = processedFile.size;
        fileType = determineFileType(processedFile.mimetype);
        mimeType = processedFile.mimetype;
        width = processedFile.dimensions?.width || null;
        height = processedFile.dimensions?.height || null;
        dimensions = processedFile.dimensions;
        dpi = processedFile.dpi || dpi;
        
      } else {
        // 4. Clone flow
        if (!data.sourceLetterheadId) {
          throw new LetterheadValidationError('INVALID_INPUT', [
            'Source letterhead ID is required for cloning',
          ]);
        }
        console.log("faizyrehman","Source letterhead ID is")
        const sourceLetterhead = await this.letterheadRepository.findById(data.sourceLetterheadId);
        if (!sourceLetterhead) {
          throw new LetterheadError(
            'NOT_FOUND',
            'Source letterhead not found'
          );
        }
         
  
        // Copy file data from source - now we need to copy the file itself
        // For cloning, we need to actually copy the file in storage
        if (!sourceLetterhead.filePath) {
          throw new LetterheadError('STORAGE_MISSING', 'Source letterhead has no filePath');
        }
        const fileBuffer = await this.storageService.downloadFile(sourceLetterhead.filePath);
        
        
        const cloneResult = await this.storageService.uploadLetterhead(
          fileBuffer,
          `clone_${sourceLetterhead.name}_${Date.now()}`,
          {
            userId,
            organizationId: data.organizationId || undefined,
            mimetype: sourceLetterhead.mimeType,
          }
        );
        
        filePath = cloneResult.path;
        fileSize = sourceLetterhead.fileSize;
        fileType = mapStringToLetterheadType(sourceLetterhead.fileType);
        mimeType = sourceLetterhead.mimeType;
        width = sourceLetterhead.width;
        height = sourceLetterhead.height;
        dpi = sourceLetterhead.dpi;
        
        // Clone thumbnail if exists
        if (sourceLetterhead.thumbnailPath) {
          const thumbBuffer = await this.storageService.downloadFile(sourceLetterhead.thumbnailPath);
          const thumbUpload = await this.storageService.uploadLetterhead(
            thumbBuffer,
            `clone_thumb_${sourceLetterhead.name}_${Date.now()}`,
            { userId, mimetype: 'image/jpeg' }
          );
          thumbnailPath = thumbUpload.path;
        }
      }
  
      // 5. Prepare data for repository
      const letterheadData: RepositoryCreateLetterheadData = {
        // Fields from request data
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        
        // Boolean fields - use the values from request
        isActive: data.isActive !== undefined ? data.isActive : true,
        isPublic: data.isPublic !== undefined ? data.isPublic : false,
        isSystem: data.isSystem !== undefined ? data.isSystem : false, // Add this!
        
      

        // Bleed area fields
        hasBleedArea: data.hasBleedArea !== undefined ? data.hasBleedArea : false,
        bleedAreaSize: data.bleedAreaSize || undefined,
        
        // Layout fields
        margins: data.margins || { top: 57.6, right: 18, bottom: 36, left: 18 },
        safeZones: data.safeZones || {
          header: { top: 72, bottom: 144, left: 36, right: 36 },
          footer: { top: 648, bottom: 36, left: 36, right: 36 }
        },
        paperSize: data.paperSize || 'A4',
        orientation: data.orientation || 'PORTRAIT',
        
        // Color and design fields
        backgroundColor: data.backgroundColor || null,
        opacity: data.opacity || 1.0,
        brandColors: data.brandColors || ['#000000', '#FFFFFF'],
        primaryFont: data.primaryFont || undefined,
        secondaryFont: data.secondaryFont || undefined,
        colorProfile: data.colorProfile || 'RGB',
        dimensionsUnit: data.dimensionsUnit || 'POINTS',
        
        // File-related fields
        userId,
        filePath: filePath!,
        thumbnailPath: thumbnailPath || undefined,
        fileSize,
        fileType,
        mimeType,
        width,
        height,
        dpi,
        marginSafeZone: calculateMarginSafeZone(dimensions) || null,
        
        // Other fields
        usageCount: 0,
        organizationId: data.organizationId || null,
        version: data.version || '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // 6. Create letterhead record
      const letterhead = await this.letterheadRepository.create(letterheadData);
  
      // 7. Log success
      this.logger.info('Letterhead created successfully', {
        requestId,
        letterheadId: letterhead.id,
        userId,
        operation: file ? 'upload' : 'clone',
        duration: Date.now() - startTime,
      });
      return {
        ...letterhead,
        filePath: letterhead.filePath ?? null,
        thumbnailPath: letterhead.thumbnailPath ?? null,
        fileUrl: letterhead.filePath ?? null,
        thumbnailUrl: letterhead.thumbnailPath ?? null,
        publishedAt: letterhead.createdAt ?? null,
        parentId: letterhead.parentId ?? null,
        lastUsedAt: letterhead.lastUsedAt ?? null,
        bleedAreaSize: letterhead.bleedAreaSize ?? null,
        secondaryFont: letterhead.secondaryFont ?? null,
      
        primaryFont: letterhead.primaryFont ?? null,
      }

    } catch (error) {
      this.logger.error('Letterhead creation failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
  
      throw error;
    }
  }

  

  // ============ PRIVATE METHODS ============


 
 

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
      throw new LetterheadDuplicateError(
        name,
        userId,
        organizationId
      );
    }
  }

  private async processUploadedFile(
    file: LetterheadFile,
    requestId: string
  ): Promise<ProcessedFile> {
    const dimensions = await this.storageService.extractImageDimensions(file!.data, file?.mimetype!);
  //  const metadata = await this.imageProcessor.extractMetadata(file.data);


  
    let thumbnailBuffer: Buffer | undefined;
    let thumbnailPath: string | undefined;
    const fileId = uuidv4();
  
    
    const detectedExt =
    await detectExtensionFromBufferOptimized(file.data);
  
  const extension =
    normalizeExtensionFromBuffer(file.data, detectedExt);

      try {
        const thumbData = await this.storageService.generateThumbnail(
          file.data,
          {
            width: this.config.thumbnailWidth || 300,
            height: this.config.thumbnailHeight || 300,
            quality: this.config.thumbnailQuality || 85,
            format: 'jpeg' as 'jpeg',
          },
          file.mimetype,
          fileId,
          extension
        );
        console.log('Thumbnail generation result:', {
          path: thumbData?.path,
          bufferSize: thumbData?.buffer?.length,
          error: thumbData?.error?.message
        });
        if (thumbData?.path) {
          thumbnailPath = thumbData.path;
          thumbnailBuffer = thumbData.buffer!;
        }
        else if (thumbData?.buffer) {
          // If we have buffer but no path, upload it manually
          console.log('Uploading thumbnail buffer manually...');
          const thumbFilename = `thumb_${fileId}_300x300.jpeg`;
          const thumbUploadResult = await this.storageService.uploadLetterhead(
            thumbData.buffer,
            thumbFilename,
            {
              mimetype: 'image/jpeg',
            }
          );
          thumbnailPath = thumbUploadResult.path;
          thumbnailBuffer = thumbData.buffer;
        }
      
       
      } catch (error) {
        this.logger.warn('Failed to generate thumbnail', {
          requestId,
          filename: file.filename,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
   // }

   if (dimensions && dimensions.width && dimensions.height) {
    this.validatePrintDimensions(dimensions);
  }


  return {
    buffer: file.data,
    filename: this.generateSafeFilename(file.filename,extension),
    mimetype: file.mimetype,
    size: file.size,
    dimensions: dimensions,
    dpi: dimensions.dpi,
    thumbnailBuffer,
    thumbnailPath
  };
  }

  private validatePrintDimensions(dimensions: { width: number; height: number }): void {
   
    console.log("dimensions.width",dimensions.width)
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
  private generateSafeFilename(originalFilename: string, extension: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
     

    const safeName = originalFilename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    return `letterhead_${timestamp}_${random}_${safeName}${extension}`;
  }
}