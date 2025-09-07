import { NextRequest, NextResponse } from "next/server";
import { ZMAX, parentOf, childrenOf } from "@/lib/coords";
import { db } from "@/lib/adapters/db";
import { readTileFile } from "@/lib/storage";
import { generateParentTile } from "@/lib/parentTiles";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ z: string, x: string, y: string }> }) {
  const { z: zStr, x: xStr, y: yStr } = await params;
  const z = Number(zStr), x = Number(xStr), y = Number(yStr);
  
  console.log(`🗑️ DELETE request for tile z:${z} x:${x} y:${y}`);
  
  if (z !== ZMAX) {
    return NextResponse.json({ error: "Only max zoom tiles can be deleted" }, { status: 400 });
  }

  try {
    // Note: R2 files are immutable and use content-based naming, so we don't need to delete the file
    // The tile will effectively be "deleted" by marking it as EMPTY in the database
    console.log(`   R2 tile remains in storage but marked as deleted in database`);
    
    // Update database to mark as empty
    await db.updateTile(z, x, y, { 
      status: "EMPTY", 
      hash: undefined, 
      contentHash: undefined,
      contentVer: 0 
    });
    
    // Regenerate parent tiles up the chain in the background
    (async () => {
      try {
        let cz = z, cx = x, cy = y;
        while (cz > 0) {
          const p = parentOf(cz, cx, cy);
          // If any child exists, rebuild the parent; otherwise mark parent as EMPTY
          const kids = childrenOf(p.z, p.x, p.y);
          const buffers = await Promise.all(kids.map(async k => {
            const tileRecord = await db.getTile(k.z, k.x, k.y);
            if (tileRecord?.status === "READY" && tileRecord.contentHash) {
              return await readTileFile(k.z, k.x, k.y, tileRecord.contentHash);
            }
            return null;
          }));
          const hasAnyChild = buffers.some(b => b !== null);
          if (hasAnyChild) {
            await generateParentTile(p.z, p.x, p.y);
          } else {
            await db.updateTile(p.z, p.x, p.y, { 
              status: "EMPTY", 
              hash: undefined, 
              contentHash: undefined,
              contentVer: 0 
            });
          }
          cz = p.z; cx = p.x; cy = p.y;
        }
      } catch (err) {
        console.error(`   ⚠️ Error regenerating parents after delete ${z}/${x}/${y}:`, err);
      }
    })().catch(() => {});
    
    console.log(`   ✅ Tile deleted successfully`);
    return NextResponse.json({ ok: true, message: "Tile deleted" });
  } catch (error) {
    console.error(`Failed to delete tile ${z}/${x}/${y}:`, error);
    return NextResponse.json({ 
      error: "Failed to delete tile", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
