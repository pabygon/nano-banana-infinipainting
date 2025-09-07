import fs from "node:fs/promises";
import path from "node:path";
import { TILE_DIR } from "./paths";
import { r2Storage } from "./adapters/storage.r2";
import { blake2sHex } from "./hashing";

const USE_R2 = process.env.USE_R2_STORAGE === "true";
const IS_VERCEL = process.env.VERCEL === "1";

let ensured = false;
async function ensureTileDir() {
  if (!ensured && !USE_R2) {
    await fs.mkdir(TILE_DIR, { recursive: true }).catch(() => {});
    ensured = true;
  }
}

export function tilePath(z: number, x: number, y: number) {
  return path.join(TILE_DIR, `${z}_${x}_${y}.webp`);
}

export async function readTileFile(z: number, x: number, y: number, hash?: string): Promise<Buffer | null> {
  if (USE_R2) {
    try {
      return await r2Storage.readTile(z, x, y, hash);
    } catch (error) {
      console.error(`❌ R2 read failed for z:${z} x:${x} y:${y}:`, error);
      // On Vercel, we can't fall back to local storage
      if (IS_VERCEL) {
        return null;
      }
      // Local development fallback
      try { 
        return await fs.readFile(tilePath(z, x, y)); 
      } catch { 
        return null; 
      }
    }
  }
  
  // Local storage (development only)
  try { 
    return await fs.readFile(tilePath(z, x, y)); 
  } catch { 
    return null; 
  }
}

export async function writeTileFile(z: number, x: number, y: number, buf: Buffer, hash?: string): Promise<void> {
  // Calculate content hash if not provided (for R2 filename)
  const contentHash = hash || blake2sHex(buf).slice(0, 16);
  
  if (USE_R2) {
    try {
      await r2Storage.writeTile(z, x, y, buf, contentHash);
      return;
    } catch (error) {
      console.error(`❌ R2 write failed for z:${z} x:${x} y:${y}:`, error);
      
      if (IS_VERCEL) {
        // In production on Vercel, we MUST fail completely
        // Don't attempt local storage - it won't work
        throw new Error(`Failed to save tile to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Local development fallback only
      console.log(`🔄 Falling back to local storage for z:${z} x:${x} y:${y}`);
      await ensureTileDir();
      await fs.writeFile(tilePath(z, x, y), buf);
      return;
    }
  }

  // Local storage (development only)
  await ensureTileDir();
  await fs.writeFile(tilePath(z, x, y), buf);
}

export function getTileUrl(z: number, x: number, y: number, hash?: string): string | null {
  if (USE_R2) {
    return r2Storage.getPublicUrl(z, x, y, hash);
  }
  return null; // Local tiles served via API
}