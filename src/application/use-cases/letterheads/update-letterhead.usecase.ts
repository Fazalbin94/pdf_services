 
import type { LetterheadFile, UpdateLetterheadData } from '../../dto/letterhead.dto.js';
import type { Letterhead, LetterheadUpdateInput } from '../../../domain/entities/letterhead.entity.js';
import { 
  LetterheadError, 
  LetterheadNotFoundError,
  LetterheadAccessDeniedError,
  LetterheadValidationError,
  LetterheadDuplicateError 
} from '../../../domain/errors/letterhead-error.js';
import { LetterheadRepository } from '@application/interfaces/letterhead-repository.interface.js';
import { IStorageService } from '@application/interfaces/storage-service.js';
 
export class UpdateLetterheadUseCase {
  constructor(
    private readonly letterheadRepository: LetterheadRepository,
    private readonly storageService: IStorageService
  ) {}

  async execute(
    userId: string,
    letterheadId: string,
    data: UpdateLetterheadData,
    organizationId?: string | null
  ): Promise<Letterhead> {
    try {

      const existingLetterhead = await this.letterheadRepository.findById(letterheadId);
      
      if (!existingLetterhead) {
        throw new LetterheadNotFoundError(letterheadId);
      }


      this.validateAccess(existingLetterhead, userId, organizationId);


      if (existingLetterhead.deletedAt && data.deletedAt === null) {

        return await this.restoreLetterhead(letterheadId, data);
      }

      if (existingLetterhead.deletedAt) {
        throw new LetterheadError(
          'LETTERHEAD_DELETED',
          `Cannot update deleted letterhead: ${letterheadId}`
        );
      }


      this.validateUpdateData(data);


      if (data.name && data.name !== existingLetterhead.name) {
        await this.checkDuplicateName(
          data.name,
          userId,
          organizationId,
          letterheadId
        );
      }


      const updateData = this.prepareUpdateData(data, existingLetterhead);


      const updatedLetterhead = await this.letterheadRepository.update(
        letterheadId,
        updateData
      );


      await this.logLetterheadUpdate(updatedLetterhead, userId);

      return updatedLetterhead;

    } catch (error) {
      if (
        error instanceof LetterheadError ||
        error instanceof LetterheadNotFoundError ||
        error instanceof LetterheadAccessDeniedError ||
        error instanceof LetterheadValidationError ||
        error instanceof LetterheadDuplicateError
      ) {
        throw error;
      }
      
      throw new LetterheadError(
        'UPDATE_FAILED',
        'Failed to update letterhead',
        error as Error
      );
    }
  }
  private async updateFileIfNeeded(
    _letterheadId: string,
    existingLetterhead: Letterhead,
    newFile?: LetterheadFile
  ): Promise<{ filePath?: string; thumbnailPath?: string }> {
    if (!newFile) {
      return {};
    }


    if (existingLetterhead.filePath) {
      await this.storageService.deleteFile(existingLetterhead.filePath);
    }
    if (existingLetterhead.thumbnailPath) {
      await this.storageService.deleteFile(existingLetterhead.thumbnailPath);
    }


    const uploaded = await this.storageService.uploadLetterhead(
      newFile.data,
      newFile.filename,
      { mimetype: newFile.mimetype }
    );

    return {
      filePath: uploaded.path!,
      thumbnailPath: uploaded.thumbnailPath,
    };
  }


  private validateAccess(
    letterhead: Letterhead,
    userId: string,
    organizationId?: string | null
  ): void {

 if (letterhead.isSystem) {
    return;
  }
    if (letterhead.userId !== userId) {
       console.log("LetterheadAccessDeniedError1")
      throw new LetterheadAccessDeniedError(letterhead.id);
    }


    if (organizationId && letterhead.organizationId && letterhead.organizationId !== organizationId) {
      console.log("LetterheadAccessDeniedError",organizationId)
         console.log("LetterheadAccessDeniedError",letterhead.organizationId)
      throw new LetterheadAccessDeniedError(letterhead.id);
    }
  }

  private async restoreLetterhead(
    letterheadId: string,
    data: UpdateLetterheadData
  ): Promise<Letterhead> {
    const updateData = {
      ...data,
      deletedAt: null,
      isActive: true,
      updatedAt: new Date(),
    };

    return await this.letterheadRepository.update(letterheadId, updateData);
  }

  private validateUpdateData(data: UpdateLetterheadData): void {
    const errors: string[] = [];


    if (data.name !== undefined) {
      if (!data.name.trim()) {
        errors.push('Letterhead name cannot be empty');
      } else if (data.name.length > 100) {
        errors.push('Letterhead name must be 100 characters or less');
      }
    }


    if (data.description !== undefined && data.description && data.description.length > 500) {
      errors.push('Description must be 500 characters or less');
    }


    if (data.category !== undefined && data.category && data.category.length > 50) {
      errors.push('Category must be 50 characters or less');
    }


    if (data.backgroundColor && !/^#[0-9A-Fa-f]{6}$/.test(data.backgroundColor)) {
      errors.push('Background color must be a valid hex color (e.g., #FF0000)');
    }


    if (data.opacity !== undefined && (data.opacity < 0 || data.opacity > 1)) {
      errors.push('Opacity must be between 0 and 1');
    }

    if (errors.length > 0) {
      throw new LetterheadValidationError('INVALID_UPDATE_DATA', errors);
    }
  }

  private async checkDuplicateName(
    name: string,
    userId: string,
    organizationId: string | null | undefined,
    excludeLetterheadId: string
  ): Promise<void> {
    const existingLetterhead = await this.letterheadRepository.findByName(
      name,
      userId,
      organizationId || null
    );

    if (existingLetterhead && 
        existingLetterhead.id !== excludeLetterheadId && 
        !existingLetterhead.deletedAt) {
      throw new LetterheadDuplicateError(name, userId, organizationId);
    }
  }

 private prepareUpdateData(
  data: UpdateLetterheadData,
  existingLetterhead: Letterhead
): LetterheadUpdateInput {
  const updateData: LetterheadUpdateInput = { ...data };

  updateData.updatedAt = new Date();

  if (data.usageCount !== undefined) {
    updateData.usageCount = existingLetterhead.usageCount + 1;
  }

  return updateData;
}


  private async logLetterheadUpdate(letterhead: Letterhead, userId: string): Promise<void> {

    console.log(`Letterhead updated: ${letterhead.id} by user ${userId}`);
  }
}