import { NextRequest, NextResponse } from "next/server";
import { ZMAX } from "@/lib/coords";
import { z as zod } from "zod";
import { db } from "@/lib/adapters/db.file";
import { fileQueue } from "@/lib/adapters/queue.file";
import { SignatureVerifier } from "@/lib/signatureVerification";

const Body = zod.object({ prompt: zod.string().min(1, "Prompt is required").max(500) });

const ApiHeaders = zod.object({
  "x-api-key": zod.string().min(1, "API key is required"),
  "x-api-provider": zod.enum(["Google", "FAL"]).default("Google")
});

export async function POST(req: NextRequest, { params }:{params:Promise<{z:string,x:string,y:string}>}) {
  const { z: zStr, x: xStr, y: yStr } = await params;
  const z = Number(zStr), x = Number(xStr), y = Number(yStr);
  console.log(`\n🎯 CLAIM API: Received request for tile z:${z} x:${x} y:${y}`);
  
  if (z !== ZMAX) return NextResponse.json({ error:"Only max zoom can be claimed" }, { status:400 });

  // Validate request body
  const body = await req.json().catch(()=>({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    console.log(`   ❌ Validation error: ${firstError?.message || 'Invalid input'}`);
    return NextResponse.json({ error: firstError?.message || 'Invalid input' }, { status: 400 });
  }
  const { prompt } = parsed.data;
  console.log(`   Prompt: "${prompt}"`);

  // Check for signed request first
  const authHeader = req.headers.get("authorization");
  const USE_SIGNATURE_VERIFICATION = false; // Set to true to enable signature verification
  
  let apiKey: string;
  let apiProvider: string;
  
  if (USE_SIGNATURE_VERIFICATION && authHeader) {
    console.log(`   🔐 Verifying signed request`);
    
    // For signed requests, we still need the API key to verify the signature
    // In production, you might look up the key from a database using a key ID
    const providedApiKey = req.headers.get("x-api-key");
    if (!providedApiKey) {
      return NextResponse.json({ error: 'API key required for signature verification' }, { status: 401 });
    }
    
    const method = "POST";
    const url = `/api/claim/${z}/${x}/${y}`;
    const bodyStr = JSON.stringify({ prompt });
    
    const verification = await SignatureVerifier.verifyRequest(
      authHeader,
      method,
      url,
      bodyStr,
      providedApiKey
    );
    
    if (!verification.isValid) {
      console.log(`   ❌ Signature verification failed: ${verification.error}`);
      return NextResponse.json({ error: verification.error }, { status: 401 });
    }
    
    apiKey = verification.apiKey!;
    apiProvider = req.headers.get("x-api-provider") || "Google";
    console.log(`   ✅ Signature verified successfully`);
  } else {
    // Traditional API key validation
    const headers = {
      "x-api-key": req.headers.get("x-api-key") || "",
      "x-api-provider": req.headers.get("x-api-provider") || "Google"
    };
    const headersParsed = ApiHeaders.safeParse(headers);
    if (!headersParsed.success) {
      const firstError = headersParsed.error.issues[0];
      console.log(`   ❌ API headers validation error: ${firstError?.message || 'Invalid headers'}`);
      return NextResponse.json({ error: firstError?.message || 'API key required' }, { status: 400 });
    }
    apiKey = headersParsed.data["x-api-key"];
    apiProvider = headersParsed.data["x-api-provider"];
  }
  
  console.log(`   API Provider: ${apiProvider}`);

  // Check if tile is already being processed
  const existing = await db.getTile(z, x, y);
  if (existing?.status === "PENDING") {
    console.log(`   ⚠️ Tile already pending, skipping`);
    return NextResponse.json({ ok:true, status:"ALREADY_PENDING", message:"Tile generation already in progress" });
  }

  try {
    await db.upsertTile({ z,x,y, status:"PENDING" });        // idempotent mark
    console.log(`   Tile marked as PENDING in database`);
    
    await fileQueue.enqueue(`gen-${z}-${x}-${y}`, { z,x,y,prompt,apiKey,apiProvider }); // in-process
    console.log(`   ✅ Tile generation job enqueued successfully`);
    
    return NextResponse.json({ ok:true, status:"ENQUEUED" });
  } catch (error) {
    console.error(`   ❌ Failed to enqueue tile generation for ${z}/${x}/${y}:`, error);
    // Reset status on error
    await db.updateTile(z,x,y, { status:"EMPTY" });
    return NextResponse.json({ error:"Failed to start generation", details: error instanceof Error ? error.message : "Unknown error" }, { status:500 });
  }
}