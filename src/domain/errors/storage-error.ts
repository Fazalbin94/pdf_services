// src/domain/errors/storage-error.ts
import { DomainError } from './domain-error.js';

export class StorageError extends DomainError {
  constructor(
    code: string,
    message: string,
    originalError?: Error
  ) {
    super('STORAGE', code, message, 500, originalError);
  }
}


export class UploadFailedError extends StorageError {
  constructor(fileName: string, originalError?: Error) {
    super('UPLOAD_FAILED', `Failed to upload file: ${fileName}`, originalError);
  }
}

export class DownloadFailedError extends StorageError {
  constructor(filePath: string, originalError?: Error) {
    super('DOWNLOAD_FAILED', `Failed to download file: ${filePath}`, originalError);
  }
}

export class FileNotFoundError extends StorageError {
  constructor(filePath: string) {
    super('FILE_NOT_FOUND', `File not found: ${filePath}`);
  }
}

export class InvalidFileTypeError extends StorageError {
  constructor(fileType: string, allowedTypes: string[]) {
    super('INVALID_FILE_TYPE', 
      `File type ${fileType} not allowed. Allowed types: ${allowedTypes.join(', ')}`
    );
  }
}

export class FileTooLargeError extends StorageError {
  constructor(fileSize: number, maxSize: number) {
    super('FILE_TOO_LARGE',
      `File size ${fileSize} bytes exceeds maximum allowed size of ${maxSize} bytes`
    );
  }
}