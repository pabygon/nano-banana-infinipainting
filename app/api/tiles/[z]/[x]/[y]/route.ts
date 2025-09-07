import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { readTileFile, getTileUrl } from "@/lib/storage";
import { blake2sHex } from "@/lib/hashing";
import { db } from "@/lib/adapters/db";

const DEFAULT_PATH = process.env.DEFAULT_TILE_PATH ?? "./public/default-tile.webp";
const ENABLE_R2_REDIRECT = process.env.ENABLE_R2_REDIRECT === "true";

export async function GET(_req: NextRequest, { params }:{params:Promise<{z:string,x:string,y:string}>}) {
  const { z: zStr, x: xStr, y: yStr } = await params;
  const z = Number(zStr), x = Number(xStr), y = Number(yStr);
  
  console.log(`📦 Tile request: z:${z} x:${x} y:${y}`);

  // Get tile metadata to extract content hash for R2 filename
  let contentHash: string | undefined;
  const tileRecord = await db.getTile(z, x, y);
  if (tileRecord?.status === "READY" && tileRecord.contentHash) {
    contentHash = tileRecord.contentHash;
    console.log(`   Found content hash: ${contentHash}`);
  }

  // Option 1: Redirect to R2 public URL (fastest, reduces server load)
  if (ENABLE_R2_REDIRECT && contentHash) {
    // Only redirect if we have a content hash (meaning tile exists and is ready)
    const r2Url = getTileUrl(z, x, y, contentHash);
    if (r2Url) {
      console.log(`   Redirecting to R2: ${r2Url} (hash: ${contentHash})`);
      return NextResponse.redirect(r2Url, { status: 307 });
    }
  }

  // Option 2: Proxy through your API (slower, but maintains control)
  let body = await readTileFile(z, x, y, contentHash);
  if (!body) {
    console.log(`   Tile not found in R2, serving default tile`);
    body = await fs.readFile(path.resolve(DEFAULT_PATH));
  } else {
    console.log(`   Found tile in R2, buffer size: ${body.length} bytes${contentHash ? ` (hash: ${contentHash})` : ''}`);
  }

  const etag = `"${blake2sHex(body).slice(0,16)}"`;
  return new NextResponse(body as any, {
    status: 200,
    headers: {
      "Content-Type":"image/webp",
      "Cache-Control":"public, max-age=31536000, immutable",
      "ETag": etag
    }
  });
}