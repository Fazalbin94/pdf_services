import { UpdateLetterheadData } from "@application/dto/letterhead.dto.js";
import { LetterheadRepository } from "@application/interfaces/letterhead-repository.interface.js";
import { Letterhead } from "@domain/entities/letterhead.entity.js";
import { LetterheadDuplicateError, LetterheadNotFoundError } from "@domain/errors/letterhead-error.js";
 
import { validateLetterHeadAccess } from "@shared/letterhead/lettherhead.js";

export class PatchLetterheadUseCase {
    constructor(
      private readonly letterheadRepository: LetterheadRepository,
    ) {}
  
    async execute(
      userId: string,
      letterheadId: string,
      data: Partial<UpdateLetterheadData>,
      organizationId?: string | null
    ): Promise<Letterhead> {
      const existing = await this.letterheadRepository.findById(letterheadId);
      if (!existing) throw new LetterheadNotFoundError(letterheadId);
      
      // Validate access
      validateLetterHeadAccess(existing, userId, organizationId);
      
      // Check name duplicate if name is being changed
      if (data.name && data.name !== existing.name) {
        await  this.checkDuplicateName(data.name, userId, organizationId, letterheadId);
      }
      
      // Prepare update data
      const updateData: Partial<UpdateLetterheadData> = {
        ...data,
        updatedAt: new Date()
      };
      
      // Increment usageCount if provided
      if (data.usageCount !== undefined) {
        updateData.usageCount = existing.usageCount + 1;
      }
      
      // Set lastUsedAt if usageCount is being incremented
      if (data.usageCount !== undefined) {
        updateData.lastUsedAt = new Date();
      }
      
      return await this.letterheadRepository.update(letterheadId, updateData);
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
   
  }