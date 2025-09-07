import fs from "node:fs/promises";
import path from "node:path";

const STYLE_PATH = process.env.STYLE_PATH ?? "./public/style-control/config.json";
const STYLE_REF = process.env.STYLE_REF ?? "./public/style-control/ref.png";

export async function loadStyleControl() {
  let cfg: any;
  let ref: Buffer | null = null;
  
  try {
    // First try to fetch from public URL (works in Vercel)
    try {
      const response = await fetch(new URL('/style-control/config.json', 
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      ));
      if (response.ok) {
        const json = await response.text();
        cfg = JSON.parse(json);
        console.log(`✅ Loaded style config from public URL`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (urlError) {
      console.log(`❌ Failed to fetch style config from public URL: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
      // Fallback: try filesystem
      const json = await fs.readFile(STYLE_PATH, "utf-8");
      cfg = JSON.parse(json);
      console.log(`✅ Loaded style config from filesystem: ${STYLE_PATH}`);
    }
    
    // Try to load reference image (optional)
    try {
      // Try public URL first
      try {
        const refResponse = await fetch(new URL('/style-control/ref.png', 
          process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
        ));
        if (refResponse.ok) {
          ref = Buffer.from(await refResponse.arrayBuffer());
          console.log(`✅ Loaded style reference from public URL`);
        } else {
          throw new Error(`HTTP ${refResponse.status}`);
        }
      } catch (refUrlError) {
        // Fallback: try filesystem
        ref = await fs.readFile(STYLE_REF);
        console.log(`✅ Loaded style reference from filesystem: ${STYLE_REF}`);
      }
    } catch (refError) {
      console.log(`ℹ️ No style reference image found (optional)`);
      ref = null;
    }
    
  } catch (error) {
    console.error(`❌ Failed to load style configuration:`, error);
    // Return a default configuration
    cfg = {
      name: "default",
      palette: {
        deep: "#143C82",
        shallow: "#1E5AA0", 
        beach: "#F0E6B4",
        grass: "#328C3C",
        hills: "#5B503C",
        snow: "#E6E6E6"
      },
      model: {
        sampler: "dpmpp_2m",
        steps: 25,
        cfg: 5.5
      }
    };
    console.log(`🔄 Using default style configuration`);
  }
  
  return { cfg, ref, name: cfg.name ?? "default" };
}