export type TileStatus = "EMPTY" | "PENDING" | "READY";

export interface TileRecord {
  z: number; x: number; y: number;
  status: TileStatus;
  seed?: string;          // hex or decimal string
  hash?: string;          // tile payload hash (algorithm + content + seed)
  contentHash?: string;   // image content hash (used for R2 filename)
  contentVer?: number;    // increments on change
  updatedAt?: string;     // ISO date
  createdAt?: string;     // ISO date
  // Simple generation lock fields
  locked?: boolean;       // true when generating
  locked_at?: string;     // ISO timestamp when lock acquired
  locked_by?: string;     // user/client ID
}

export interface DB {
  getTile(z:number,x:number,y:number): Promise<TileRecord | null>;
  upsertTile(tr: Partial<TileRecord> & { z:number; x:number; y:number }): Promise<TileRecord>;
  updateTile(z:number,x:number,y:number, patch: Partial<TileRecord>): Promise<TileRecord>;
  getTiles(batch: {z:number,x:number,y:number}[]): Promise<TileRecord[]>;
}

export function key(z:number,x:number,y:number) { return `${z}_${x}_${y}`; }

// Import both implementations
import { FileDB } from './db.file';

// Database instance - conditionally choose implementation
const USE_SUPABASE_DB = process.env.USE_SUPABASE_DB === 'true';

// Create database instance based on environment
function createDB(): DB {
  if (USE_SUPABASE_DB) {
    console.log('📊 Using Supabase database');
    // Lazy import Supabase to avoid loading it when not needed
    try {
      const { supabaseDB } = require('./db.supabase');
      return supabaseDB;
    } catch (error) {
      console.error('Failed to load Supabase DB, falling back to FileDB:', error);
      return new FileDB();
    }
  } else {
    console.log('📁 Using file-based database');
    return new FileDB();
  }
}

export const db = createDB();