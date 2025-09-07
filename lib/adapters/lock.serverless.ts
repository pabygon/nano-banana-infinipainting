// Serverless-compatible locking using in-memory Map
// Note: This only provides locking within a single function instance
// For distributed locking across function instances, you'd need Redis or similar

const activeLocks = new Map<string, { acquired: number; timeout: NodeJS.Timeout }>();
const LOCK_TIMEOUT = 30000; // 30 seconds

function lockKey(name: string): string {
  return `lock:${name}`;
}

export async function withFileLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const key = lockKey(name);
  
  // Check if lock already exists
  if (activeLocks.has(key)) {
    throw new Error(`Lock timeout: ${name}`);
  }
  
  // Acquire lock
  const timeout = setTimeout(() => {
    activeLocks.delete(key);
  }, LOCK_TIMEOUT);
  
  activeLocks.set(key, { acquired: Date.now(), timeout });
  
  try {
    console.log(`🔒 Acquired serverless lock: ${name}`);
    return await fn();
  } finally {
    // Release lock
    const lock = activeLocks.get(key);
    if (lock) {
      clearTimeout(lock.timeout);
      activeLocks.delete(key);
      console.log(`🔓 Released serverless lock: ${name}`);
    }
  }
}

// Clean up any stale locks (though they should auto-expire)
export function cleanupStaleLocks(): void {
  const now = Date.now();
  for (const [key, lock] of activeLocks.entries()) {
    if (now - lock.acquired > LOCK_TIMEOUT) {
      clearTimeout(lock.timeout);
      activeLocks.delete(key);
    }
  }
}
