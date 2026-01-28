
export interface MangaPage {
  id: string;
  name: string;
  originalUrl: string;
  base64: string;
  processedUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface ProcessingOptions {
  colorize: boolean;
  translate: boolean;
  targetLanguage: string;
  quality: 'standard' | 'high';
}

export interface ProcessingLog {
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error';
}
