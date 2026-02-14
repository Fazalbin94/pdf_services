
 
import { LetterheadRepository } from '@application/interfaces/letterhead-repository.interface.js';
import type { Letterhead } from '../../../domain/entities/letterhead.entity.js';
import { 
  LetterheadError, 
  LetterheadNotFoundError,
  LetterheadAccessDeniedError 
} from '../../../domain/errors/letterhead-error.js';
import { IStorageService } from '@application/interfaces/storage-service.js';
 
export class DeleteLetterheadUseCase {
  constructor(
    private readonly letterheadRepository: LetterheadRepository,
    private readonly storageService: IStorageService
  ) {}

  async execute(
    userId: string,
    letterheadId: string,
    organizationId?: string | null,
    forceDelete: boolean = false
  ): Promise<void> {
    try {

      const letterhead = await this.letterheadRepository.findById(letterheadId);
      
      if (!letterhead) {
        throw new LetterheadNotFoundError(letterheadId);
      }


      this.validateAccess(letterhead, userId, organizationId);


      if (letterhead.deletedAt && !forceDelete) {
        throw new LetterheadError(
          'ALREADY_DELETED',
          `Letterhead ${letterheadId} is already deleted`
        );
      }


      if (letterhead.isSystem && !forceDelete) {
        throw new LetterheadError(
          'SYSTEM_LETTERHEAD',
          'Cannot delete system letterheads'
        );
      }


      if (letterhead.usageCount > 0 && !forceDelete) {
        throw new LetterheadError(
          'LETTERHEAD_IN_USE',
          `Cannot delete letterhead that is in use (used ${letterhead.usageCount} times)`
        );
      }


      if (forceDelete) {

        await this.hardDeleteLetterhead(letterheadId, letterhead);
      } else {

        await this.softDeleteLetterhead(letterheadId);
      }


      await this.logLetterheadDeletion(letterheadId, userId, forceDelete);

    } catch (error) {
      if (
        error instanceof LetterheadNotFoundError ||
        error instanceof LetterheadAccessDeniedError ||
        error instanceof LetterheadError
      ) {
        throw error;
      }
      
      throw new LetterheadError(
        'DELETE_FAILED',
        'Failed to delete letterhead',
        error as Error
      );
    }
  }

  private validateAccess(
    letterhead: Letterhead,
    userId: string,
    organizationId?: string | null
  ): void {


    if (letterhead.userId !== userId) {
      throw new LetterheadAccessDeniedError(letterhead.id);
    }


    if (organizationId && letterhead.organizationId && letterhead.organizationId !== organizationId) {
      throw new LetterheadAccessDeniedError(letterhead.id);
    }
  }

  private async softDeleteLetterhead(letterheadId: string): Promise<void> {

    await this.letterheadRepository.softDelete(letterheadId);
    

    await this.letterheadRepository.update(letterheadId, {
      isActive: false,
      isPublic: false,
    });
  }

  private async hardDeleteLetterhead(letterheadId: string, letterhead: Letterhead): Promise<void> {
    try {

      if (letterhead.filePath) {
        await this.storageService.deleteFile(letterhead.filePath);
      }
      
      if (letterhead.thumbnailPath) {
        await this.storageService.deleteFile(letterhead.thumbnailPath);
      }
    } catch (storageError) {

      console.error('Failed to delete files from storage:', storageError);
    }


    await this.letterheadRepository.delete(letterheadId);
  }

  private async logLetterheadDeletion(
    letterheadId: string,
    userId: string,
    forceDelete: boolean
  ): Promise<void> {
    const action = forceDelete ? 'HARD_DELETE' : 'SOFT_DELETE';
    

    console.log(`Letterhead ${action}: ${letterheadId} by user ${userId}`);
  }
}