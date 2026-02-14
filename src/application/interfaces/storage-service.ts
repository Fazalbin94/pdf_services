import { DownloadFileResult } from "@presentation/http/letterheads/types/letterhead.response.js";

export interface IStorageService {
 uploadPdf(
   buffer: Buffer,
   options?: {
     filename?: string;
     folder?: 'permanent' | 'previews' | 'thumbnails';  
     userId?: string;
     templateId?: string;
     metadata?: Record<string, string>;
   }
 ): Promise<{
   path: string;  
   fileId: string;
 }>;
 downloadFile(fileUrl: string): Promise<Buffer>;
 
 getSingleFile(filePath: string): Promise<DownloadFileResult>;
 
 downloadPdf(filePath: string): Promise<{
   buffer: Buffer;
   metadata: {
     contentType: string;
     contentLength: number;
     lastModified: string;
     etag: string;
     cacheControl: string;
   };
 }>;

 deletePdf(filePath: string): Promise<void>;

 deleteFile(fileUrl: string): Promise<void>;



 getFileMetadata(filePath: string): Promise<any>;
 listFiles(folder: string, options?: any): Promise<any[]>;
 cleanupExpiredPreviews(expirationHours?: number): Promise<number>;
 healthCheck(): Promise<any>;
 ensureBuckets(): Promise<void>;

 uploadLetterhead(
   buffer: Buffer,
   originalFilename: string,
   options?: {
     userId?: string;
     organizationId?: string;
     category?: string;
     metadata?: Record<string, string>;
     mimetype?: string;
   }

   
 ): Promise<{
     
 
   path: string;  
   fileId: string;
   dimensions?: { width: number; height: number };
   thumbnailPath?: string;  
 }>;

 getSecureUrl(
   filePath: string,
   options?: {
     expiresIn?: number;
     download?: boolean;
     downloadName?: string;
     contentType?: string;
   }
 ): Promise<{
   signedUrl: string;
   expiresAt: Date;
   contentType: string;
 }>;

  

 extractImageDimensions(buffer: Buffer, mimetype: string): Promise<{
   width: number;
   height: number;
   dpi?: number;
 }>;
 
 
 
 
 generateThumbnail(
  buffer?: Buffer, 

options?: {
  width: number;
  height: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
},
mimeType?: string,
fileId?: string, 
extension?: string,
): Promise<{
  path: string | null;
  buffer: Buffer | null;
  error?: Error;
}>;

 
 


 
generateSignedUrl(
  filePath: string,
  options?: {
    expiresIn?: number;
    download?: boolean;
    downloadName?: string;
  }
): Promise<string>;
//testing:
// debugStorage(): Promise<{
//   status: 'success' | 'error';
//   details: any;
// }>;
//  checkBucketHealth(bucketName: string): Promise<any>;
//  testFileExistence(filePath: string): Promise<{
//   path: string;
//   exists: boolean;
//   size?: number;
//   error?: string;
//   publicUrl?: string;
// }> ;
// testUpload(): Promise<{
//   success: boolean;
//   filePath?: string;
//   error?: string;
//   duration?: number;
// }>;
// debugPath(filePath: string): Promise<{
//   exists: boolean;
//   details: any;
//   alternatives?: string[];
// }>;
// findSimilarFiles(filePath: string): Promise<string[]>;
 
}