 
/* ------------------------------------------------------------------ */
/* IMAGE PROCESSOR ERRORS */
/* ------------------------------------------------------------------ */

import { DomainError } from "./index.js";

export class ImageProcessorError extends DomainError {
  constructor(
    code: string,
    message: string,
    originalError?: Error,
    statusCode: number = 422
  ) {
    super(
      'IMAGE_PROCESSOR',
      code,
      message,
      statusCode,
      originalError
    );
  }
}

/* ------------------------------------------------------------------ */
/* SPECIFIC IMAGE PROCESSOR ERRORS */
/* ------------------------------------------------------------------ */

export class ImageMetadataExtractionFailedError extends ImageProcessorError {
  constructor(originalError?: Error) {
    super(
      'METADATA_EXTRACTION_FAILED',
      'Failed to extract image metadata',
      originalError
    );
  }
}

export class ImageFormatNotSupportedError extends ImageProcessorError {
  constructor(format: string) {
    super(
      'UNSUPPORTED_FORMAT',
      `Image format "${format}" is not supported`,
      undefined,
      415
    );
  }
}

export class ImageTooLargeError extends ImageProcessorError {
  constructor(maxSizeMB: number) {
    super(
      'IMAGE_TOO_LARGE',
      `Image exceeds maximum allowed size of ${maxSizeMB}MB`,
      undefined,
      413
    );
  }
}
