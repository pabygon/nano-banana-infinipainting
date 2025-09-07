// Adaptive lock system - chooses implementation based on environment

export async function withFileLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const isServerless = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;
  
  if (isServerless) {
    console.log('🔒 Using serverless lock (in-memory)');
    const { withFileLock: serverlessLock } = require('./lock.serverless');
    return serverlessLock(name, fn);
  } else {
    console.log('📁 Using file-based lock');
    const { withFileLock: fileLock } = require('./lock.file');
    return fileLock(name, fn);
  }
}
