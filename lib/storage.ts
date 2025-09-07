import { r2Storage } from "./adapters/storage.r2";
import { blake2sHex } from "./hashing";

/**
 * Read a tile from R2 storage
 */
export async function readTileFile(z: number, x: number, y: number, hash?: string): Promise<Buffer | null> {
  try {
    return await r2Storage.readTile(z, x, y, hash);
  } catch (error) {
    console.error(`❌ R2 read failed for z:${z} x:${x} y:${y}:`, error);
    return null;
  }
}

/**
 * Write a tile to R2 storage
 */
export async function writeTileFile(z: number, x: number, y: number, buf: Buffer, hash?: string): Promise<void> {
  // Calculate content hash if not provided (for R2 filename)
  const contentHash = hash || blake2sHex(buf).slice(0, 16);
  
  try {
    await r2Storage.writeTile(z, x, y, buf, contentHash);
  } catch (error) {
    console.error(`❌ R2 write failed for z:${z} x:${x} y:${y}:`, error);
    throw new Error(`Failed to save tile to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the public URL for a tile in R2 storage
 */
export function getTileUrl(z: number, x: number, y: number, hash?: string): string | null {
  return r2Storage.getPublicUrl(z, x, y, hash);
}