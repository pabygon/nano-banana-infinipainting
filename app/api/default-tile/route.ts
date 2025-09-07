import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

// Cache the default tile in memory
let defaultTileBuffer: Buffer | null = null;

async function getDefaultTile(): Promise<Buffer> {
  if (defaultTileBuffer) {
    return defaultTileBuffer;
  }

  // Generate default tile with a subtle grid pattern
  const svg = `
    <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" fill="#808080"/>
      <g stroke="#707070" stroke-width="1" fill="none">
        <line x1="0" y1="0" x2="256" y2="0"/>
        <line x1="0" y1="256" x2="256" y2="256"/>
        <line x1="0" y1="0" x2="0" y2="256"/>
        <line x1="256" y1="0" x2="256" y2="256"/>
        <line x1="128" y1="0" x2="128" y2="256" stroke-dasharray="4,4"/>
        <line x1="0" y1="128" x2="256" y2="128" stroke-dasharray="4,4"/>
      </g>
    </svg>
  `;

  defaultTileBuffer = await sharp(Buffer.from(svg))
    .webp({ quality: 80 })
    .toBuffer();

  return defaultTileBuffer;
}

export async function GET(_req: NextRequest) {
  try {
    const defaultTile = await getDefaultTile();
    
    return new NextResponse(defaultTile as any, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      }
    });
  } catch (error) {
    console.error("Failed to generate default tile:", error);
    return new NextResponse(null, { status: 500 });
  }
}
