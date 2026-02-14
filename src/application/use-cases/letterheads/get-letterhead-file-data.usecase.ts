// /apps/pdf-service/src/application/use-cases/letterheads/get-letterhead-file-data.usecase.ts

import { IStorageService } from "@application/interfaces/storage-service.js";
import { LetterheadError } from "@domain/errors/index.js";

 

export interface GetLetterheadFileDataInput {
  filePath: string;
  thumbnailPath?: string;
  securityOption: 'base64' | 'signed-url';
  expiresIn?: number;
}

export interface GetLetterheadFileDataOutput {
  fileData: string;
  thumbnailData?: string;
  expiresAt?: Date;
  mimeType?: string;
}

export class GetLetterheadFileDataUseCase {
  constructor(private readonly storageService: IStorageService) {}

  async execute(
    input: GetLetterheadFileDataInput
  ): Promise<GetLetterheadFileDataOutput> {
    try {
      const { filePath, thumbnailPath, securityOption, expiresIn = 3600 } = input;

      if (!filePath) {
        throw new LetterheadError(
          'INVALID_INPUT',
          'File path is required'
        );
      }

      if (securityOption === 'base64') {
        return await this.getAsBase64(filePath, thumbnailPath);
      } else {
        return await this.getAsSignedUrl(filePath, thumbnailPath, expiresIn);
      }
    } catch (error) {
      if (error instanceof LetterheadError) {
        throw error;
      }
      
      throw new LetterheadError(
        'FILE_RETRIEVAL_FAILED',
        'Failed to retrieve letterhead file data',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async getAsBase64(
    filePath: string,
    thumbnailPath?: string
  ): Promise<GetLetterheadFileDataOutput> {
    try {
      // Get main file
      const fileResult = await this.storageService.getSingleFile(filePath);
      const fileBase64 = fileResult.buffer.toString('base64');
      
      // Get thumbnail if exists
      let thumbnailBase64: string | undefined;
      if (thumbnailPath) {
        try {
          const thumbResult = await this.storageService.getSingleFile(thumbnailPath);
          thumbnailBase64 = thumbResult.buffer.toString('base64');
        } catch (thumbError) {
          console.warn('Failed to retrieve thumbnail:', thumbError);
          // Continue without thumbnail
        }
      }

      return {
        fileData: `data:${fileResult.mimeType || 'application/octet-stream'};base64,${fileBase64}`,
        thumbnailData: thumbnailBase64 
          ? `data:image/jpeg;base64,${thumbnailBase64}`
          : undefined,
        mimeType: fileResult.mimeType,
      };
    } catch (error) {
      throw new LetterheadError(
        'BASE64_RETRIEVAL_FAILED',
        'Failed to convert file to base64',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async getAsSignedUrl(
    filePath: string,
    thumbnailPath?: string,
    expiresIn: number = 3600
  ): Promise<GetLetterheadFileDataOutput> {
    try {
      // Generate signed URL for main file
      const fileSignedUrl = await this.storageService.generateSignedUrl(
        filePath,
        { expiresIn, download: false }
      );
      
      // Generate signed URL for thumbnail if exists
      let thumbnailSignedUrl: string | undefined;
      if (thumbnailPath) {
        try {
          thumbnailSignedUrl = await this.storageService.generateSignedUrl(
            thumbnailPath,
            { expiresIn, download: false }
          );
        } catch (thumbError) {
          console.warn('Failed to generate signed URL for thumbnail:', thumbError);
          // Continue without thumbnail
        }
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      return {
        fileData: fileSignedUrl,
        thumbnailData: thumbnailSignedUrl,
        expiresAt,
      };
    } catch (error) {
      throw new LetterheadError(
        'SIGNED_URL_GENERATION_FAILED',
        'Failed to generate signed URL',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}