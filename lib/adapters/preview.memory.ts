// In-memory preview storage for serverless environments
// Stores preview images in memory with automatic cleanup

interface PreviewData {
  buffer: Buffer;
  createdAt: number;
  expiresAt: number;
}

const previews = new Map<string, PreviewData>();
const PREVIEW_TTL = 10 * 60 * 1000; // 10 minutes

// Cleanup expired previews
function cleanupExpired() {
  const now = Date.now();
  for (const [id, data] of previews.entries()) {
    if (now > data.expiresAt) {
      previews.delete(id);
    }
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupExpired, 5 * 60 * 1000);

export const memoryPreview = {
  async store(id: string, buffer: Buffer): Promise<void> {
    const now = Date.now();
    previews.set(id, {
      buffer,
      createdAt: now,
      expiresAt: now + PREVIEW_TTL
    });
    console.log(`📦 Stored preview ${id} in memory (${buffer.length} bytes)`);
  },

  async get(id: string): Promise<Buffer | null> {
    const data = previews.get(id);
    if (!data) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > data.expiresAt) {
      previews.delete(id);
      return null;
    }
    
    return data.buffer;
  },

  async delete(id: string): Promise<void> {
    previews.delete(id);
    console.log(`🗑️ Deleted preview ${id} from memory`);
  },

  getStats() {
    const now = Date.now();
    let totalSize = 0;
    let activeCount = 0;
    
    for (const data of previews.values()) {
      if (now <= data.expiresAt) {
        totalSize += data.buffer.length;
        activeCount++;
      }
    }
    
    return {
      activeCount,
      totalSize,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
    };
  }
};
