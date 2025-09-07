// Adaptive preview storage - file system for dev, memory for serverless

interface PreviewStorage {
  store(id: string, buffer: Buffer): Promise<void>;
  get(id: string): Promise<Buffer | null>;
  delete(id: string): Promise<void>;
}

function createPreviewStorage(): PreviewStorage {
  const isServerless = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;
  
  if (isServerless) {
    console.log('📦 Using in-memory preview storage');
    const { memoryPreview } = require('./preview.memory');
    return memoryPreview;
  } else {
    console.log('📁 Using file-based preview storage');
    const { filePreview } = require('./preview.file');
    return filePreview;
  }
}

export const previewStorage = createPreviewStorage();
