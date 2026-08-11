// ============================================================
// API Route: /api/vision
// Triggers the Vision Agent for 6-View 3D Spatial Geometry Analysis
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runVisionAgent } from "@/lib/agents/visionAgent";
import type { VisionAgentInput } from "@/lib/types/agentSchema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType, backgroundRemoved, multiViewImages } = body;

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "imageBase64 and mimeType are required" },
        { status: 400 }
      );
    }

    const input: VisionAgentInput = {
      imageBase64,
      mimeType,
      backgroundRemoved: backgroundRemoved ?? false,
      multiViewImages,
    };

    const { output, error } = await runVisionAgent(input);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true, output });
  } catch (error) {
    console.error("[Vision API] Error:", error);
    return NextResponse.json(
      { error: "Vision analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}
