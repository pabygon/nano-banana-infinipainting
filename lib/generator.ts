import sharp from "sharp";
import { TILE, ZMAX } from "./coords";
import { writeTileFile, readTileFile } from "./storage";
import { db } from "./adapters/db";
import { blake2sHex, hashTilePayload } from "./hashing";
// Removed style loading - using hardcoded style for simplicity
import ai from "./gemini";

function buildCubistPrompt(subject = "urban desert skyline with cacti and airships", opts: { movement?: string } = {}) {
  const style = {
    movement: opts.movement || "Analytical Cubism", // or "Synthetic Cubism"
    medium: "colored-pencil + ink on textured paper (visible grain, light cross-hatching)",
    palette: "muted desert tones: terracotta, ochre, sage green, dusty rose, charcoal; low saturation",
    mechanics:
      "break all forms into angular, overlapping planar facets; strong diagonals; multiple viewpoints simultaneously (profile + frontal cues); shallow/orthographic depth; hard-edged shadows to separate planes; curves approximated by straight segments",
    composition:
      "square, full-bleed image that touches all four edges; design must tile seamlessly on every side (let major lines and shapes exit/enter across edges)",
    constraints:
      "no frames, borders, margins, text, logos, drop shadows, gradients, lens effects, photorealistic rendering, anime/cartoon outlines, or 3D render look"
  };

  return `
Create a ${style.movement} illustration of ${subject}.
Use ${style.medium}. Palette: ${style.palette}.
Composition: ${style.composition}.
Style mechanics: ${style.mechanics}.
${style.constraints}.
Purpose: collaborative mural tile that must continue into neighboring tiles.
`;
}

type NeighborDir = "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";
const dirs: [NeighborDir, number, number][] = [
  ["N", 0, -1], ["S", 0, 1], ["E", 1, 0], ["W", -1, 0],
  ["NE", 1, -1], ["NW", -1, -1], ["SE", 1, 1], ["SW", -1, 1],
];

async function getNeighbors(z: number, x: number, y: number) {
  const out: { dir: NeighborDir, buf: Buffer | null }[] = [];
  for (const [dir, dx, dy] of dirs) {
    // Get neighbor tile metadata to extract content hash
    const neighborRecord = await db.getTile(z, x + dx, y + dy);
    const neighborContentHash = neighborRecord?.status === "READY" ? neighborRecord.contentHash : undefined;
    
    out.push({ dir, buf: await readTileFile(z, x + dx, y + dy, neighborContentHash) });
  }
  return out;
}

/** Generate tile using Gemini nano-banana model */
async function runModel(input: {
  prompt: string;
  styleName: string;
  neighbors: { dir: NeighborDir, buf: Buffer | null }[];
  seedHex: string;
  apiKey?: string;
  apiProvider?: string;
}): Promise<Buffer> {

  try {
    // Create a 3x3 grid (768x768) with the center marked for generation
    const gridSize = TILE * 3; // 768x768

    // Create a checkerboard pattern for unknown areas
    const checkerSize = 16; // Size of each checker square
    const lightGrey = { r: 200, g: 200, b: 200 };
    const white = { r: 255, g: 255, b: 255 };

    // Create checkerboard pattern using SVG
    const checkerboardSvg = `
      <svg width="${gridSize}" height="${gridSize}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="checkerboard" x="0" y="0" width="${checkerSize * 2}" height="${checkerSize * 2}" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="${checkerSize}" height="${checkerSize}" fill="rgb(${white.r},${white.g},${white.b})" />
            <rect x="${checkerSize}" y="0" width="${checkerSize}" height="${checkerSize}" fill="rgb(${lightGrey.r},${lightGrey.g},${lightGrey.b})" />
            <rect x="0" y="${checkerSize}" width="${checkerSize}" height="${checkerSize}" fill="rgb(${lightGrey.r},${lightGrey.g},${lightGrey.b})" />
            <rect x="${checkerSize}" y="${checkerSize}" width="${checkerSize}" height="${checkerSize}" fill="rgb(${white.r},${white.g},${white.b})" />
          </pattern>
        </defs>
        <rect width="${gridSize}" height="${gridSize}" fill="url(#checkerboard)" />
      </svg>
    `;

    // Create the canvas with checkerboard background
    const canvas = sharp(Buffer.from(checkerboardSvg));

    // Build the composite layers
    const compositeImages: any[] = [];

    // Center stays black (no green square needed)

    // Map neighbors to grid positions
    const neighborPositions: { [key: string]: { x: number, y: number } } = {
      'NW': { x: 0, y: 0 }, 'N': { x: TILE, y: 0 }, 'NE': { x: TILE * 2, y: 0 },
      'W': { x: 0, y: TILE },    /* CENTER */                'E': { x: TILE * 2, y: TILE },
      'SW': { x: 0, y: TILE * 2 }, 'S': { x: TILE, y: TILE * 2 }, 'SE': { x: TILE * 2, y: TILE * 2 }
    };

    // Add existing neighbors
    const neighborCount = input.neighbors.filter(n => n.buf !== null).length;

    for (const n of input.neighbors) {
      if (n.buf && neighborPositions[n.dir]) {
        const pos = neighborPositions[n.dir];
        // Ensure neighbor is exactly 256x256
        const resized = await sharp(n.buf)
          .resize(TILE, TILE, { fit: 'fill' })
          .toBuffer();
        compositeImages.push({
          input: resized,
          left: pos.x,
          top: pos.y
        });
      }
    }

    // Create the composite grid
    const gridImage = await canvas
      .composite(compositeImages)
      .png()
      .toBuffer();

    // Debug: Save the grid (enable for debugging)
    const DEBUG_MODE = true; // Set to true to save debug images
    if (DEBUG_MODE) {
      await sharp(gridImage).toFile(`.debug/debug-grid-${input.seedHex}.png`);
    }

    // Convert to base64 for Gemini
    const gridBase64 = gridImage.toString('base64');

    // Build the prompt using the new buildCubistPrompt function
    const subject = input.prompt || 'Include random things in the image';
    const fullPrompt = buildCubistPrompt(subject).trim();
    console.log('🎨 Generated Cubist Prompt (runModel):', fullPrompt);

    const userParts: any[] = [
      { text: fullPrompt },
      {
        inlineData: {
          data: gridBase64,
          mimeType: 'image/png'
        }
      }
    ];

    const contents = [{
      role: 'user',
      parts: userParts
    }];

    const config = {
      responseModalities: ['IMAGE'],
    };

    const model = 'gemini-2.5-flash-image-preview';

    const startTime = Date.now();

    // Use user-provided API key if available, otherwise fallback to environment
    let aiClient = ai;
    if (input.apiKey && input.apiProvider === "Google") {
      const { GoogleGenAI } = await import('@google/genai');
      aiClient = new GoogleGenAI({ apiKey: input.apiKey });
    } else if (input.apiKey && input.apiProvider === "FAL") {
      // TODO: Implement FAL AI support
      return runModelStub(input);
    }

    const response = await aiClient.models.generateContentStream({
      model,
      config,
      contents,
    });

    let imageBase64: string | null = null;

    for await (const chunk of response) {
      if (chunk.promptFeedback?.blockReason) {
        throw new Error(`Content blocked: ${chunk.promptFeedback.blockReason}`);
      }

      if (chunk.candidates && chunk.candidates.length > 0) {
        const candidate = chunk.candidates[0];

        if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
          throw new Error(`Content blocked: ${candidate.finishReason}`);
        }

        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData?.data) {
              imageBase64 = part.inlineData.data;
              break;
            }
          }
          if (imageBase64) break;
        }
      }
    }

    if (!imageBase64) {
      throw new Error('No image generated from Gemini');
    }

    const elapsedTime = Date.now() - startTime;

    // Convert base64 to buffer
    const imgBuffer = Buffer.from(imageBase64, 'base64');

    // Check the actual dimensions of the returned image
    const metadata = await sharp(imgBuffer).metadata();

    // Debug: Save the response
    if (DEBUG_MODE) {
      await sharp(imgBuffer).toFile(`.debug/debug-response-${input.seedHex}.png`);
    }

    // Calculate extraction coordinates based on actual image size
    let extractLeft = TILE;
    let extractTop = TILE;
    let extractWidth = TILE;
    let extractHeight = TILE;

    if (metadata.width !== gridSize || metadata.height !== gridSize) {
      if (metadata.width && metadata.height) {
        // Calculate scale factor
        const scale = metadata.width / gridSize;

        // Scale the extraction coordinates proportionally
        extractLeft = Math.floor(TILE * scale);
        extractTop = Math.floor(TILE * scale);
        extractWidth = Math.floor(TILE * scale);
        extractHeight = Math.floor(TILE * scale);
      }
    }

    // Extract and resize the center tile
    const centerTile = await sharp(imgBuffer)
      .extract({
        left: extractLeft,
        top: extractTop,
        width: extractWidth,
        height: extractHeight
      })
      .resize(TILE, TILE, { kernel: 'lanczos3' }) // Ensure final size is always 256x256
      .webp({ quality: 90 })
      .toBuffer();

    return centerTile;
  } catch (error) {
    console.error('❌ Gemini generation error:', error);
    // Fallback to stub generator on error
    return runModelStub(input);
  }
}

/** Stub generator for fallback */
async function runModelStub(input: {
  prompt: string;
  styleName: string;
  neighbors: { dir: NeighborDir, buf: Buffer | null }[];
  seedHex: string;
  apiKey?: string;
  apiProvider?: string;
}): Promise<Buffer> {
  const base = sharp({
    create: {
      width: TILE, height: TILE, channels: 3,
      background: { r: parseInt(input.seedHex.slice(0, 2), 16), g: parseInt(input.seedHex.slice(2, 4), 16), b: (input.prompt.length * 19) % 255 }
    }
  }).png();

  let img = await base.toBuffer();

  const overlays: Buffer[] = [];
  for (const n of input.neighbors) {
    if (!n.buf) continue;
    const line = Buffer.from(
      `<svg width="${TILE}" height="${TILE}"><rect ${edgeRect(n.dir)} fill="#ffffff" fill-opacity="0.15"/></svg>`
    );
    overlays.push(await sharp(line).png().toBuffer());
  }

  if (overlays.length) {
    img = await sharp(img).composite(overlays.map(o => ({ input: o }))).toBuffer();
  }
  return await sharp(img).webp({ quality: 90 }).toBuffer();
}

function edgeRect(dir: NeighborDir): string {
  if (dir === "N") return `x="0" y="0" width="${TILE}" height="1"`;
  if (dir === "S") return `x="0" y="${TILE - 1}" width="${TILE}" height="1"`;
  if (dir === "W") return `x="0" y="0" width="1" height="${TILE}"`;
  if (dir === "E") return `x="${TILE - 1}" y="0" width="1" height="${TILE}"`;
  if (dir === "NE") return `x="${TILE - 1}" y="0" width="1" height="1"`;
  if (dir === "NW") return `x="0" y="0" width="1" height="1"`;
  if (dir === "SE") return `x="${TILE - 1}" y="${TILE - 1}" width="1" height="1"`;
  return `x="0" y="${TILE - 1}" width="1" height="1"`;
}

/** Generate a tile preview without saving to disk */
export async function generateTilePreview(z: number, x: number, y: number, prompt: string, apiKey?: string, apiProvider?: string): Promise<Buffer> {

  if (z !== ZMAX) throw new Error("Generation only at max zoom");

  const styleName = "cubist-earthy-v1"; // Hardcoded for simplicity
  const seedHex = blake2sHex(Buffer.from(`${z}:${x}:${y}:${styleName}:${prompt}`)).slice(0, 8);

  const neighbors = await getNeighbors(z, x, y);
  const buf = await runModel({ prompt, styleName, neighbors, seedHex, apiKey, apiProvider });

  return buf;
}

/**
 * Generate a full 3×3 grid preview image (768×768 WebP) containing
 * the model's predicted content for the neighborhood. Used by the
 * edit preview modal so empty cells can display inbound content.
 */
export async function generateGridPreview(z: number, x: number, y: number, prompt: string, apiKey?: string, apiProvider?: string): Promise<Buffer> {
  if (z !== ZMAX) throw new Error("Generation only at max zoom");

  const styleName = "cubist-earthy-v1"; // Hardcoded for simplicity
  const seedHex = blake2sHex(Buffer.from(`${z}:${x}:${y}:${styleName}:${prompt}`)).slice(0, 8);
  const neighbors = await getNeighbors(z, x, y);

  try {
    // Reuse the same request building as runModel but return the full grid image.
    const gridSize = TILE * 3;

    // Checkerboard background so the model has context even when neighbors are missing
    const checkerSize = 16;
    const lightGrey = { r: 200, g: 200, b: 200 };
    const white = { r: 255, g: 255, b: 255 };
    const checkerboardSvg = `
      <svg width="${gridSize}" height="${gridSize}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="checkerboard" x="0" y="0" width="${checkerSize * 2}" height="${checkerSize * 2}" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="${checkerSize}" height="${checkerSize}" fill="rgb(${white.r},${white.g},${white.b})" />
            <rect x="${checkerSize}" y="0" width="${checkerSize}" height="${checkerSize}" fill="rgb(${lightGrey.r},${lightGrey.g},${lightGrey.b})" />
            <rect x="0" y="${checkerSize}" width="${checkerSize}" height="${checkerSize}" fill="rgb(${lightGrey.r},${lightGrey.g},${lightGrey.b})" />
            <rect x="${checkerSize}" y="${checkerSize}" width="${checkerSize}" height="${checkerSize}" fill="rgb(${white.r},${white.g},${white.b})" />
          </pattern>
        </defs>
        <rect width="${gridSize}" height="${gridSize}" fill="url(#checkerboard)" />
      </svg>
    `;

    const canvas = sharp(Buffer.from(checkerboardSvg));

    const neighborPositions: { [key: string]: { x: number, y: number } } = {
      'NW': { x: 0, y: 0 }, 'N': { x: TILE, y: 0 }, 'NE': { x: TILE * 2, y: 0 },
      'W': { x: 0, y: TILE }, 'E': { x: TILE * 2, y: TILE },
      'SW': { x: 0, y: TILE * 2 }, 'S': { x: TILE, y: TILE * 2 }, 'SE': { x: TILE * 2, y: TILE * 2 }
    };

    const compositeImages: sharp.OverlayOptions[] = [];
    for (const n of neighbors) {
      if (n.buf && neighborPositions[n.dir]) {
        const pos = neighborPositions[n.dir];
        const resized = await sharp(n.buf).resize(TILE, TILE, { fit: 'fill' }).toBuffer();
        compositeImages.push({ input: resized, left: pos.x, top: pos.y });
      }
    }

    const gridContext = await canvas.composite(compositeImages).png().toBuffer();

    // Send the full grid to the model using the new buildCubistPrompt function
    const fullPrompt = buildCubistPrompt(prompt).trim();
    console.log('🎨 Generated Cubist Prompt (generateGridPreview):', fullPrompt);
    const contents = [{
      role: 'user',
      parts: [
        { text: fullPrompt },
        { inlineData: { data: gridContext.toString('base64'), mimeType: 'image/png' } }
      ]
    }];

    // Use user-provided API key if available, otherwise fallback to environment
    let aiClient = ai;
    if (apiKey && apiProvider === "Google") {
      const { GoogleGenAI } = await import('@google/genai');
      aiClient = new GoogleGenAI({ apiKey });
    } else if (apiKey && apiProvider === "FAL") {
      // TODO: Implement FAL AI support
      throw new Error('FAL AI not yet implemented');
    }

    const response = await aiClient.models.generateContentStream({
      model: 'gemini-2.5-flash-image-preview',
      config: { responseModalities: ['IMAGE'] },
      contents,
    });

    let imageBase64: string | null = null;
    for await (const chunk of response) {
      if (chunk.candidates && chunk.candidates.length > 0) {
        const candidate = chunk.candidates[0];
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData?.data) { imageBase64 = part.inlineData.data; break; }
          }
          if (imageBase64) break;
        }
      }
    }

    if (!imageBase64) throw new Error('No image generated from Gemini');
    let imgBuffer = Buffer.from(imageBase64, 'base64');

    // Normalize to 768×768 and WebP
    const meta = await sharp(imgBuffer).metadata();
    if (meta.width !== gridSize || meta.height !== gridSize) {
      // @ts-expect-error TODO: fix types
      imgBuffer = await sharp(imgBuffer).resize(gridSize, gridSize, { fit: 'fill' }).toBuffer();
    }
    return await sharp(imgBuffer).webp({ quality: 90 }).toBuffer();
  } catch (err) {
    // Fallback: compose neighbors and stub-generated center into a 3×3 grid
    const center = await runModelStub({ prompt, styleName, neighbors, seedHex, apiKey, apiProvider });

    const composites: sharp.OverlayOptions[] = [];
    // Place neighbors
    const pos = [
      [0, 0, 'NW'], [1, 0, 'N'], [2, 0, 'NE'],
      [0, 1, 'W'], [1, 1, 'C'], [2, 1, 'E'],
      [0, 2, 'SW'], [1, 2, 'S'], [2, 2, 'SE']
    ] as const;
    for (const [cx, cy, key] of pos) {
      if (key === 'C') {
        composites.push({ input: center, left: cx * TILE, top: cy * TILE });
        continue;
      }
      const n = neighbors.find(nn => nn.dir === key);
      if (n?.buf) {
        const resized = await sharp(n.buf).resize(TILE, TILE).toBuffer();
        composites.push({ input: resized, left: cx * TILE, top: cy * TILE });
      }
    }
    return sharp({
      create: { width: TILE * 3, height: TILE * 3, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).composite(composites).webp({ quality: 90 }).toBuffer();
  }
}

export async function generateTile(z: number, x: number, y: number, prompt: string, apiKey?: string, apiProvider?: string) {

  if (z !== ZMAX) throw new Error("Generation only at max zoom");

  // Mark PENDING (idempotent upsert)
  const rec = await db.upsertTile({ z, x, y, status: "PENDING" });

  const styleName = "cubist-earthy-v1"; // Hardcoded for simplicity
  const seedHex = blake2sHex(Buffer.from(`${z}:${x}:${y}:${styleName}:${prompt}`)).slice(0, 8);

  const neighbors = await getNeighbors(z, x, y);
  const buf = await runModel({ prompt, styleName, neighbors, seedHex, apiKey, apiProvider });

  const bytesHash = blake2sHex(buf).slice(0, 16);
  const contentVer = (rec.contentVer ?? 0) + 1;
  const hash = hashTilePayload({
    algorithmVersion: 1, contentVer, bytesHash, seed: seedHex
  });

  await writeTileFile(z, x, y, buf, bytesHash);

  const updated = await db.updateTile(z, x, y, { 
    status: "READY", 
    hash, 
    contentHash: bytesHash, 
    contentVer, 
    seed: seedHex 
  });

  // Generate parent tiles automatically
  generateParentTilesForChild(z, x, y).catch(err =>
    console.error(`Failed to generate parent tiles: ${err}`)
  );

  return { hash: updated.hash!, contentVer: updated.contentVer! };
}

async function generateParentTilesForChild(z: number, x: number, y: number) {
  const { generateParentTile } = await import("./parentTiles");
  const { parentOf } = await import("./coords");

  let currentZ = z;
  let currentX = x;
  let currentY = y;

  // Generate all parent tiles up to zoom level 0
  while (currentZ > 0) {
    const parent = parentOf(currentZ, currentX, currentY);
    await generateParentTile(parent.z, parent.x, parent.y);

    currentZ = parent.z;
    currentX = parent.x;
    currentY = parent.y;
  }
}
