
 
import { LetterheadRepository } from '@application/interfaces/letterhead-repository.interface.js';
import type { Letterhead } from '../../../domain/entities/letterhead.entity.js';
import { 
  LetterheadError, 
  LetterheadNotFoundError,
  LetterheadAccessDeniedError 
} from '../../../domain/errors/letterhead-error.js';
import { PublicLetterhead } from '@application/dto/letterhead.dto.js';
import { IStorageService } from '@application/interfaces/storage-service.js';

export class GetLetterheadUseCase {
  constructor(
    private readonly letterheadRepository: LetterheadRepository,
    private readonly storageService: IStorageService,
  ) {}

  async execute(
    userId: string,
    letterheadId: string,
    organizationId?: string | null,
    options?: {
      includeFiles?: boolean;
      securityOption?: 'base64' | 'signed-url';
      expiresIn?: number;
    }
  ): Promise<{
    letterhead: Letterhead;
    fileData?: {
      base64?: string;
      thumbnailBase64?: string;
      signedUrl?: string;
      thumbnailSignedUrl?: string;
      expiresAt?: Date;
    };
  }> {
    const letterhead = await this.letterheadRepository.findById(letterheadId);
    
    if (!letterhead) {
      throw new LetterheadNotFoundError('Letterhead not found');
    }

    if (!options?.includeFiles) {
      return { letterhead };
    }

    // Ensure storageService exists, or throw if not injected
    if (!this.storageService) {
      throw new Error('Storage service not available');
    }
    
 
    if (options.securityOption === 'base64') {
      const fileBuffer = await this.storageService.downloadFile(letterhead.filePath!);
      const thumbnailBuffer = letterhead.thumbnailPath 
        ? await this.storageService.downloadFile(letterhead.thumbnailPath)
        : null;

      return {
        letterhead,
        fileData: {
          base64: `data:${letterhead.mimeType};base64,${fileBuffer.toString('base64')}`,
          thumbnailBase64: thumbnailBuffer 
            ? `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`
            : undefined,
        }
      };
    } else {
      const expiresIn = options.expiresIn || 3600;
      if (!letterhead.filePath) {
        throw new Error('Letterhead filePath is undefined');
      }
      const fileSignedUrl = await this.storageService.generateSignedUrl(
        letterhead.filePath as string,
        { expiresIn }
      );
      
      const thumbnailSignedUrl = letterhead.thumbnailPath 
        ? await this.storageService.generateSignedUrl(
            letterhead.thumbnailPath,
            { expiresIn }
          )
        : undefined;

      return {
        letterhead,
        fileData: {
          signedUrl: fileSignedUrl,
          thumbnailSignedUrl,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
        }
      };
    }
  }


 
 
async executePublic(letterheadId: string): Promise<PublicLetterhead> {
  try {
    console.log('=== executePublic ===');
    console.log('Letterhead ID:', letterheadId);
    
    const letterhead = await this.letterheadRepository.findById(letterheadId);
    
    if (!letterhead) {
      console.log('Letterhead does not exist');
      throw new LetterheadNotFoundError(letterheadId);
    }
    
    console.log('Letterhead exists:', {
      id: letterhead.id,
      name: letterhead.name,
      isPublic: letterhead.isPublic,
      isActive: letterhead.isActive,
      deletedAt: letterhead.deletedAt,
    });
    
    // Check conditions
    if (letterhead.deletedAt) {
      console.log('Letterhead is soft-deleted');
      throw new LetterheadNotFoundError(letterheadId);
    }
    
    if (!letterhead.isActive) {
      console.log('Letterhead is not active');
      throw new LetterheadAccessDeniedError(letterheadId);
    }
    
    if (!letterhead.isPublic) {
      console.log('Letterhead is not public');
      throw new LetterheadAccessDeniedError(letterheadId);
    }
    
    console.log('All checks passed, returning sanitized letterhead');
    return this.sanitizePublicLetterhead(letterhead); // Now returns PublicLetterhead
    
  } catch (error) {
    console.error('Error in executePublic:', error);
    
    if (error instanceof LetterheadNotFoundError || 
        error instanceof LetterheadAccessDeniedError) {
      throw error;
    }
    
    throw new LetterheadError(
      'GET_PUBLIC_FAILED',
      'Failed to get public letterhead',
      error as Error
    );
  }
}

 
  private validateAccess(
    letterhead: Letterhead,
    userId: string,
    organizationId?: string | null
  ): void {

    if (letterhead.isPublic && letterhead.isActive) {
      return; // Public letterheads are accessible to everyone
    }


    if (letterhead.userId !== userId) {
      throw new LetterheadAccessDeniedError(letterhead.id);
    }


    if (organizationId && letterhead.organizationId && letterhead.organizationId !== organizationId) {
      throw new LetterheadAccessDeniedError(letterhead.id);
    }
  }

 private sanitizePublicLetterhead(letterhead: Letterhead): PublicLetterhead {
  // Return a new object with only public-safe properties
  return {
  id: letterhead.id,
  userId: letterhead.userId,
  organizationId: letterhead.organizationId,
  name: letterhead.name,
  description: letterhead.description,
  category: letterhead.category,

  fileSize: letterhead.fileSize,
  mimeType: letterhead.mimeType,
  width: letterhead.width,
  height: letterhead.height,
  dpi: letterhead.dpi,
  fileType: letterhead.fileType,
 
 
  marginSafeZone: letterhead.marginSafeZone,
  isActive: letterhead.isActive,
  isPublic: letterhead.isPublic,
  usageCount: letterhead.usageCount,
 
  // cleaned up duplicate/conflicting properties, preserve only intentional overrides if needed.
  updatedAt: letterhead.updatedAt,
  deletedAt: letterhead.deletedAt,
  backgroundColor: letterhead.backgroundColor,
  opacity: letterhead.opacity,
 
 
 
  
 
  createdAt: letterhead.createdAt,
  paperSize: letterhead.paperSize,
  orientation: letterhead.orientation,
  margins: {
    top:letterhead.margins.top,
    right: letterhead.margins.right,
    bottom: letterhead.margins.bottom,
    left: letterhead.margins.left
  },
  safeZones: {
    header: {
      top: letterhead.safeZones.header.top,
      bottom: letterhead.safeZones.header.bottom,
      left: letterhead.safeZones.header.left,
      right: letterhead.safeZones.header.right
    },
    footer: {
      top: letterhead.safeZones.footer.top,
      bottom: letterhead.safeZones.footer.bottom,
      left: letterhead.safeZones.footer.left,
      right: letterhead.safeZones.footer.right
    }
  },
  brandColors: letterhead.brandColors,
  dimensionsUnit: letterhead.dimensionsUnit,
  colorProfile: letterhead.colorProfile,
  hasBleedArea: letterhead.hasBleedArea,
  version: letterhead.version
};
}}