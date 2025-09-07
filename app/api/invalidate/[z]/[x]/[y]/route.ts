import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/adapters/db.file";
import { fileQueue } from "@/lib/adapters/queue.file";
import { z as zod } from "zod";

const requestSchema = zod.object({
  prompt: zod.string().min(1, "Prompt is required")
});

const ApiHeaders = zod.object({
  "x-api-key": zod.string().min(1, "API key is required"),
  "x-api-provider": zod.enum(["Google", "FAL"]).default("Google")
});

export async function POST(req: NextRequest, { params }:{params:Promise<{z:string,x:string,y:string}>}) {
  const { z: zStr, x: xStr, y: yStr } = await params;
  const z = Number(zStr), x = Number(xStr), y = Number(yStr);
  
  // Validate request body
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json({ error: firstError?.message || 'Invalid input' }, { status: 400 });
  }
  const { prompt } = parsed.data;

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
  
  const t = await db.getTile(z,x,y);
  if (!t) return NextResponse.json({ error:"Tile not found" }, { status:404 });

  await db.updateTile(z,x,y, { status:"PENDING", contentVer:(t.contentVer??0)+1 });
  await fileQueue.enqueue(`regen-${z}-${x}-${y}`, { z,x,y,prompt,apiKey,apiProvider });

  return NextResponse.json({ ok:true });
}