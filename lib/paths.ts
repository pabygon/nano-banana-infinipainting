import path from "node:path";
export const ROOT = process.cwd();
// Note: TILE_DIR removed - using R2 storage only
export const META_DIR = path.join(ROOT, ".meta");           // json per tile (only used with file-based DB)
export const LOCK_DIR = path.join(ROOT, ".locks");          // lock files (only used with file-based locks)
export const QUEUE_DIR = path.join(ROOT, ".queue");         // queue state (only used with file-based queue)