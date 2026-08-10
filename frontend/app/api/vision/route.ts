// ============================================================
// API Route: /api/vision
// Triggers the Vision Agent to analyze an uploaded image
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runVisionAgent } from "@/lib/agents/visionAgent";
import type { VisionAgentInput } from "@/lib/types/agentSchema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType, backgroundRemoved, multiViewImages } = body;

    let targetBase64 = imageBase64;
    let targetMime = mimeType;

    // If multiViewImages contains composite_grid, pass the 6-view grid canvas to Gemini Vision for 360 analysis!
    if (Array.isArray(multiViewImages)) {
      const gridItem = multiViewImages.find((m: any) => m.view === "composite_grid");
      if (gridItem && gridItem.base64) {
        targetBase64 = gridItem.base64;
        targetMime = gridItem.mimeType || "image/png";
        console.log("[Vision API] Using 6-View Composite Grid Canvas for Gemini Vision Analysis");
      }
    }

    if (!targetBase64 || !targetMime) {
      return NextResponse.json(
        { error: "imageBase64 and mimeType are required" },
        { status: 400 }
      );
    }

    const input: VisionAgentInput = {
      imageBase64: targetBase64,
      mimeType: targetMime,
      backgroundRemoved: backgroundRemoved ?? false,
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
