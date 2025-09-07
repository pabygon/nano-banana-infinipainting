import { NextRequest, NextResponse } from "next/server";
import { acquireGenerationLock, releaseGenerationLock, checkGenerationLock } from "@/lib/generationLock";
import { getUserId } from "@/lib/userSession";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ z: string; x: string; y: string }> }
) {
  try {
    const params = await context.params;
    const z = parseInt(params.z, 10);
    const centerX = parseInt(params.x, 10);
    const centerY = parseInt(params.y, 10);
    
    const userId = getUserId(req);
    
    // Try to acquire generation lock for 3x3 grid
    const lockResult = await acquireGenerationLock(z, centerX, centerY, userId);
    if (!lockResult.success) {
      return NextResponse.json(
        { error: lockResult.error },
        { status: 423 } // 423 Locked
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Generation lock acquire error:", error);
    return NextResponse.json(
      { error: "Failed to acquire generation lock" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ z: string; x: string; y: string }> }
) {
  try {
    const params = await context.params;
    const z = parseInt(params.z, 10);
    const centerX = parseInt(params.x, 10);
    const centerY = parseInt(params.y, 10);
    
    const userId = getUserId(req);
    
    await releaseGenerationLock(z, centerX, centerY, userId);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Generation lock release error:", error);
    return NextResponse.json(
      { error: "Failed to release generation lock" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ z: string; x: string; y: string }> }
) {
  try {
    const params = await context.params;
    const z = parseInt(params.z, 10);
    const centerX = parseInt(params.x, 10);
    const centerY = parseInt(params.y, 10);
    
    const lockStatus = await checkGenerationLock(z, centerX, centerY);
    
    return NextResponse.json(lockStatus);
    
  } catch (error) {
    console.error("Generation lock check error:", error);
    return NextResponse.json(
      { error: "Failed to check generation lock" },
      { status: 500 }
    );
  }
}
