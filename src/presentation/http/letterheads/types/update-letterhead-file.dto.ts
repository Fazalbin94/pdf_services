 
export interface UpdateLetterheadFileRequest {
    file: Buffer | string | File; 
    securityOption?: 'base64' | 'signed-url';
    expiresIn?: number;
  }
  
 
  export interface FastifyUpdateLetterheadFileRequest {
    file: {
      data: Buffer;
      filename: string;
      mimetype: string;
      size: number;
    };
    securityOption?: 'base64' | 'signed-url';
    expiresIn?: number;
  }
  
 // Create an interface for the response
 export interface FileDataResponse {
  fileData: string;
  thumbnailData?: string;
  expiresAt?: string;  
  mimeType?: string;
}