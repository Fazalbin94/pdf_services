import { IImageProcessor, LetterheadFile } from "@application/dto/letterhead.dto.js";
import { LetterheadRepository } from "@application/interfaces/letterhead-repository.interface.js";
import { IStorageService } from "@application/interfaces/storage-service.js";
import { Letterhead } from "@domain/entities/letterhead.entity.js";
import { LetterheadNotFoundError } from "@domain/errors/letterhead-error.js";
import { LetterheadType } from "@prisma/client";
import { v4 as uuidv4 } from 'uuid';
 import { determineFileType, validateLetterHeadAccess } from "@shared/letterhead/lettherhead.js";
import { detectExtensionFromBufferOptimized, getFileExtension, normalizeExtensionFromBuffer } from "@shared/utils/extensionUtil.js";
 export class UpdateLetterheadFileUseCase {
  constructor(
    private readonly letterheadRepository: LetterheadRepository,
    private readonly storageService: IStorageService,
  ) {}

  async execute(
    userId: string,
    letterheadId: string,
    file: LetterheadFile,
    organizationId?: string | null
  ): Promise<{
    letterhead: Letterhead;
  }> {
    try {
      console.log('=== UpdateLetterheadFileUseCase START ===');
      
      // 1. Get existing letterhead
      const existing = await this.letterheadRepository.findById(letterheadId);
      if (!existing) {
        throw new LetterheadNotFoundError(letterheadId);
      }
      
      // 2. Validate access
      validateLetterHeadAccess(existing, userId, organizationId);
      
      console.log('Existing letterhead found:', {
        id: existing.id,
        name: existing.name,
        filePath: existing.filePath,
        thumbnailPath: existing.thumbnailPath
      });
      
      // 3. Delete old files from storage
      if (existing.filePath) {
        console.log('Deleting old file:', existing.filePath);
        try {
          await this.storageService.deleteFile(existing.filePath);
        } catch (deleteError) {
          console.warn('Failed to delete old file, continuing:', deleteError);
        }
      }
      
      if (existing.thumbnailPath) {
        console.log('Deleting old thumbnail:', existing.thumbnailPath);
        try {
          await this.storageService.deleteFile(existing.thumbnailPath);
        } catch (deleteError) {
          console.warn('Failed to delete old thumbnail, continuing:', deleteError);
        }
      }
      
      // 4. Extract image dimensions
      let width: number | undefined;
      let height: number | undefined;
      let dpi: number | undefined;
      
      try {
        console.log('Extracting image dimensions...');
        const dimensions = await this.storageService.extractImageDimensions(file.data, file.mimetype);
        width = dimensions.width;
        height = dimensions.height;
        dpi = dimensions.dpi;
        console.log('Dimensions extracted:', { width, height, dpi });
      } catch (dimensionError) {
        console.warn('Failed to extract image dimensions:', dimensionError);
        // Continue without dimensions
      }
      
      // 5. Upload new file
      console.log('Uploading new file...');
      const timestamp = Date.now();
      const filename = `update_${timestamp}_${file.filename || 'letterhead'}`;
      
      const uploadResult = await this.storageService.uploadLetterhead(
        file.data,
        filename,
        {
          userId,
          organizationId: organizationId ?? undefined,
          mimetype: file.mimetype,
        }
      );
      
      console.log('File uploaded successfully:', {
        path: uploadResult.path,
        dimensions: uploadResult.dimensions
      });
      
      // 6. Generate thumbnail
      let thumbnailPath: string | undefined;
      
      try {
        console.log('Generating thumbnail...');
        
        // Extract file ID and extension for thumbnail generation
        const fileId = uuidv4(); // Generate a new file ID
        const detectedExt =
        await detectExtensionFromBufferOptimized(file.data);
      
      const extension =
        normalizeExtensionFromBuffer(file.data, detectedExt);

        
        console.log('Thumbnail generation parameters:', {
          fileId,
          extension,
          mimetype: file.mimetype
        });
        
        // Call generateThumbnail with ALL required parameters
        const thumbData = await this.storageService.generateThumbnail(
          file.data,
          { 
            width: 300, 
            height: 300, 
            quality: 85, 
            format: 'jpeg' as 'jpeg' // Explicitly cast to correct type
          },
          file.mimetype,
          fileId, // Pass fileId
          extension // Pass extension
        );
        
        console.log('Thumbnail generation result:', {
          path: thumbData?.path,
          bufferSize: thumbData?.buffer?.length,
          error: thumbData?.error?.message
        });
        
        if (thumbData?.path) {
          thumbnailPath = thumbData.path;
          console.log('Thumbnail generated:', thumbnailPath);
          
          // Verify thumbnail exists
          // try {
          //   await this.verifyThumbnail(thumbData.path);
          // } catch (verifyError) {
          //   console.warn('Thumbnail verification failed:', verifyError);
          // }
        } else if (thumbData?.buffer) {
          // If we have buffer but no path, upload it manually
          console.log('Uploading thumbnail buffer manually...');
          const thumbFilename = `thumb_${fileId}_300x300.jpeg`;
          const thumbUploadResult = await this.storageService.uploadLetterhead(
            thumbData.buffer,
            thumbFilename,
            {
              userId,
              mimetype: 'image/jpeg',
            }
          );
          thumbnailPath = thumbUploadResult.path;
          console.log('Thumbnail uploaded manually:', thumbnailPath);
        }
        
      } catch (thumbnailError) {
        console.warn('Failed to generate thumbnail:', thumbnailError);
        // Continue without thumbnail
      }
      
      // 7. Determine file type
      const fileType =  determineFileType(file.mimetype);
      console.log('File type determined:', fileType);

      // 8. Update letterhead record
      console.log('Updating database record...');
      const updateData: Partial<Letterhead> = {
        filePath: uploadResult.path,
        thumbnailPath: thumbnailPath || undefined, // Set to null if no thumbnail
        fileSize: file.size,
        mimeType: file.mimetype,
        fileType,
        width: width || existing.width,
        height: height || existing.height,
        dpi: dpi || existing.dpi,
        updatedAt: new Date()
      };
      
      const updatedLetterhead = await this.letterheadRepository.update(letterheadId, updateData);
      
      console.log('=== UpdateLetterheadFileUseCase SUCCESS ===');
      
      return {
        letterhead: updatedLetterhead
      };
      
    } catch (error) {
      console.error('=== UpdateLetterheadFileUseCase ERROR ===', error);
      throw error;
    }
  }
  
  // Helper method to extract file extension
  
 
  
  // Helper to verify thumbnail exists
 
}