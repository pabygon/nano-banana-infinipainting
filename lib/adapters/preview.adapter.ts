// Adaptive preview storage - file system for dev, memory for serverless

interface PreviewStorage {
  store(id: string, buffer: Buffer): Promise<void>;
  get(id: string): Promise<Buffer | null>;
  delete(id: string): Promise<void>;
}

function createPreviewStorage(): PreviewStorage {
  const isServerless = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;
  
  if (isServerless) {
    console.log('📦 Using R2-based preview storage for production');
    const { r2Preview } = require('./preview.r2');
    return r2Preview;
  } else {
    console.log('📁 Using file-based preview storage for development');
    const { filePreview } = require('./preview.file');
    return filePreview;
  }
}

export const previewStorage = createPreviewStorage();
