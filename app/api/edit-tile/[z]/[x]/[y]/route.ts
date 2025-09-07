import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { generateGridPreview } from "@/lib/generator";
import { readTileFile } from "@/lib/storage";
import { db } from "@/lib/adapters/db";
import { TILE } from "@/lib/coords";
import { acquireGenerationLock, releaseGenerationLock } from "@/lib/generationLock";
import { getUserId } from "@/lib/userSession";

const TILE_SIZE = TILE;

const requestSchema = z.object({
  prompt: z.string().min(1),
  applyToAllNew: z.boolean().optional(),
  newTilePositions: z.array(z.object({
    x: z.number(),
    y: z.number()
  })).optional(),
});

const ApiHeaders = z.object({
  "x-api-key": z.string().min(1, "API key is required"),
  "x-api-provider": z.enum(["Google", "FAL"]).default("Google")
});

// Create circular gradient mask that fully contains within 3x3 grid
async function createCircularGradientMask(size: number): Promise<Buffer> {
  const center = size / 2;
  // Radius should touch the midpoint of each side of the 3x3 grid
  const radius = size / 2;
  
  // Create a buffer for the mask
  const maskWidth = size;
  const maskHeight = size;
  const channels = 4; // RGBA
  const pixelData = Buffer.alloc(maskWidth * maskHeight * channels);
  
  // Generate gradient mask pixel by pixel
  for (let y = 0; y < maskHeight; y++) {
    for (let x = 0; x < maskWidth; x++) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate alpha based on distance from center
      let alpha: number;
      if (distance <= radius * 0.5) {
        // Full opacity in the center (50% of radius)
        alpha = 255;
      } else if (distance >= radius) {
        // Fully transparent at the edge and beyond
        alpha = 0;
      } else {
        // Smooth gradient from 50% to 100% of radius
        const normalizedDist = (distance - radius * 0.5) / (radius * 0.5);
        alpha = Math.round(255 * (1 - normalizedDist));
      }
      
      const index = (y * maskWidth + x) * channels;
      pixelData[index] = 255;     // R
      pixelData[index + 1] = 255; // G
      pixelData[index + 2] = 255; // B
      pixelData[index + 3] = alpha; // A
    }
  }
  
  return sharp(pixelData, {
    raw: {
      width: maskWidth,
      height: maskHeight,
      channels: channels as 1 | 2 | 3 | 4,
    },
  })
    .png()
    .toBuffer();
}

// Fetch tiles for 3x3 grid
async function fetchTileGrid(z: number, centerX: number, centerY: number): Promise<Buffer[][]> {
  const grid: Buffer[][] = [];
  
  const defaultTileBuffer = await readTileFile(0, 0, 0);
  const defaultTile = defaultTileBuffer || Buffer.from([]); // fallback empty buffer
  
  for (let dy = -1; dy <= 1; dy++) {
    const row: Buffer[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      
      // Get tile metadata to extract content hash
      const tileRecord = await db.getTile(z, x, y);
      const tileContentHash = tileRecord?.status === "READY" ? tileRecord.contentHash : undefined;
      
      const tileBuffer = await readTileFile(z, x, y, tileContentHash) || defaultTile;
      row.push(tileBuffer);
    }
    grid.push(row);
  }
  
  return grid;
}

// Composite 3x3 grid into single image
async function compositeTiles(grid: Buffer[][]): Promise<Buffer> {
  const gridSize = TILE_SIZE * 3;
  const composites: sharp.OverlayOptions[] = [];
  
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      composites.push({
        input: grid[y][x],
        left: x * TILE_SIZE,
        top: y * TILE_SIZE,
      });
    }
  }
  
  return sharp({
    create: {
      width: gridSize,
      height: gridSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp()
    .toBuffer();
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const params = await context.params;
  const z = parseInt(params.z, 10);
  const x = parseInt(params.x, 10);
  const y = parseInt(params.y, 10);
  
  const userId = getUserId(req);
  const body = await req.json();
  const { prompt } = requestSchema.parse(body);

  // Validate API headers
  const headers = {
    "x-api-key": req.headers.get("x-api-key") || "",
    "x-api-provider": req.headers.get("x-api-provider") || "Google"
  };
  const headersParsed = ApiHeaders.safeParse(headers);
  if (!headersParsed.success) {
    const firstError = headersParsed.error.issues[0];
    return NextResponse.json({ error: firstError?.message || 'API key required' }, { status: 400 });
  }
  const { "x-api-key": apiKey, "x-api-provider": apiProvider } = headersParsed.data;
  
  // Verify user has the generation lock for the center tile (should have been acquired when modal opened)
  const centerTile = await db.getTile(z, x, y);
  if (!centerTile?.locked || centerTile.locked_by !== userId) {
    return NextResponse.json(
      { error: "Generation lock required to edit tile" },
      { status: 423 }
    );
  }
  
  try {
    console.log(`Starting generation for tile ${z}/${x}/${y} with prompt: "${prompt}"`);
    
    // Generate the preview with API key
    const finalComposite = await generateGridPreview(z, x, y, prompt, apiKey, apiProvider);
    
    // Save preview to temporary location
    const tempDir = path.join(process.cwd(), '.temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const previewId = `preview-${z}-${x}-${y}-${Date.now()}`;
    const previewPath = path.join(tempDir, `${previewId}.webp`);
    await fs.writeFile(previewPath, finalComposite);
    
    console.log(`Generation completed for tile ${z}/${x}/${y}, preview saved as ${previewId}`);
    
    return NextResponse.json({ 
      previewUrl: `/api/preview/${previewId}`, 
      previewId 
    });
    
  } catch (error) {
    console.error(`Generation failed for tile ${z}/${x}/${y}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to edit tile" },
      { status: 500 }
    );
  }
}
