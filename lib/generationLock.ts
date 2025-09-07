import { db } from './adapters/db.file';
import { withFileLock } from './adapters/lock.file';

const LOCK_DURATION = 2 * 60 * 1000; // 2 minutes in milliseconds

function get3x3GridTiles(centerX: number, centerY: number): Array<{x: number, y: number}> {
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      tiles.push({ x: centerX + dx, y: centerY + dy });
    }
  }
  return tiles;
}

export async function acquireGenerationLock(
  z: number, 
  centerX: number, 
  centerY: number, 
  userId: string
): Promise<{ success: boolean; error?: string }> {
  
  return withFileLock(`gen-lock-grid-${z}-${centerX}-${centerY}`, async () => {
    const gridTiles = get3x3GridTiles(centerX, centerY);
    const now = new Date();
    
    // Check if ANY tile in the 3x3 grid is locked by someone else
    for (const tilePos of gridTiles) {
      const tile = await db.getTile(z, tilePos.x, tilePos.y);
      
      if (tile?.locked && tile.locked_by !== userId) {
        const lockTime = tile.locked_at ? new Date(tile.locked_at) : null;
        const isExpired = !lockTime || (now.getTime() - lockTime.getTime()) > LOCK_DURATION;
        
        if (!isExpired) {
          const expiresAt = lockTime ? new Date(lockTime.getTime() + LOCK_DURATION) : now;
          return { 
            success: false, 
            error: `Cannot edit this area - tile (${tilePos.x},${tilePos.y}) is being edited by another user. Try again with another tile.` 
          };
        }
        
        // Lock expired, we can take over
        console.log(`Taking over expired lock for tile ${z}/${tilePos.x}/${tilePos.y}`);
      }
    }
    
    // Acquire locks for ALL tiles in the 3x3 grid
    for (const tilePos of gridTiles) {
      await db.upsertTile({
        z, x: tilePos.x, y: tilePos.y,
        locked: true,
        locked_at: now.toISOString(),
        locked_by: userId
      });
    }
    
    console.log(`Generation lock acquired for 3x3 grid centered at ${z}/${centerX}/${centerY} by ${userId}`);
    return { success: true };
  });
}

export async function releaseGenerationLock(
  z: number, 
  centerX: number, 
  centerY: number, 
  userId: string
): Promise<void> {
  
  return withFileLock(`gen-lock-grid-${z}-${centerX}-${centerY}`, async () => {
    const gridTiles = get3x3GridTiles(centerX, centerY);
    
    // Release locks for ALL tiles in the 3x3 grid that we own
    let releasedCount = 0;
    for (const tilePos of gridTiles) {
      const tile = await db.getTile(z, tilePos.x, tilePos.y);
      
      if (tile?.locked_by === userId) {
        await db.updateTile(z, tilePos.x, tilePos.y, {
          locked: false,
          locked_at: undefined,
          locked_by: undefined
        });
        releasedCount++;
      }
    }
    
    if (releasedCount > 0) {
      console.log(`Generation lock released for ${releasedCount} tiles in 3x3 grid centered at ${z}/${centerX}/${centerY} by ${userId}`);
    } else {
      console.log(`Cannot release locks for 3x3 grid centered at ${z}/${centerX}/${centerY} - not owned by ${userId}`);
    }
  });
}

export async function checkGenerationLock(
  z: number, 
  centerX: number, 
  centerY: number
): Promise<{ locked: boolean; lockedBy?: string; expiresAt?: Date }> {
  
  const gridTiles = get3x3GridTiles(centerX, centerY);
  const now = new Date();
  
  // Check if ANY tile in the 3x3 grid is locked
  for (const tilePos of gridTiles) {
    const tile = await db.getTile(z, tilePos.x, tilePos.y);
    
    if (tile?.locked && tile.locked_by && tile.locked_at) {
      const lockTime = new Date(tile.locked_at);
      const expiresAt = new Date(lockTime.getTime() + LOCK_DURATION);
      const isExpired = now >= expiresAt;
      
      if (isExpired) {
        // Clean up expired lock for this tile
        console.log(`Cleaning up expired lock for tile ${z}/${tilePos.x}/${tilePos.y}`);
        await db.updateTile(z, tilePos.x, tilePos.y, {
          locked: false,
          locked_at: undefined,
          locked_by: undefined
        });
        continue;
      }
      
      // Found an active lock
      return {
        locked: true,
        lockedBy: tile.locked_by,
        expiresAt
      };
    }
  }
  
  return { locked: false };
}

export async function canEditTile(
  z: number, 
  centerX: number, 
  centerY: number, 
  userId: string
): Promise<{ canEdit: boolean; error?: string }> {
  
  const gridTiles = get3x3GridTiles(centerX, centerY);
  const now = new Date();
  
  // Check if ANY tile in the 3x3 grid is locked by someone else
  for (const tilePos of gridTiles) {
    const tile = await db.getTile(z, tilePos.x, tilePos.y);
    
    if (tile?.locked && tile.locked_by !== userId && tile.locked_at) {
      const lockTime = new Date(tile.locked_at);
      const isExpired = (now.getTime() - lockTime.getTime()) > LOCK_DURATION;
      
      if (!isExpired) {
        const expiresAt = new Date(lockTime.getTime() + LOCK_DURATION);
        return { 
          canEdit: false, 
          error: `Cannot edit this area - overlapping tile (${tilePos.x},${tilePos.y}) is being edited by another user. Try again with another tile.`
        };
      }
    }
  }
  
  return { canEdit: true };
}
