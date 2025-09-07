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
}

export interface DB {
  getTile(z:number,x:number,y:number): Promise<TileRecord | null>;
  upsertTile(tr: Partial<TileRecord> & { z:number; x:number; y:number }): Promise<TileRecord>;
  updateTile(z:number,x:number,y:number, patch: Partial<TileRecord>): Promise<TileRecord>;
  getTiles(batch: {z:number,x:number,y:number}[]): Promise<TileRecord[]>;
}

export function key(z:number,x:number,y:number) { return `${z}_${x}_${y}`; }