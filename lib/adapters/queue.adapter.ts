import { Queue } from "./queue";

// Determine which queue implementation to use
function createQueue(): Queue {
  const isServerless = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;
  
  if (isServerless) {
    console.log('📡 Using serverless queue (in-memory)');
    const { serverlessQueue } = require('./queue.serverless');
    return serverlessQueue;
  } else {
    console.log('📁 Using file-based queue');
    const { fileQueue } = require('./queue.file');
    return fileQueue;
  }
}

export const queue = createQueue();
