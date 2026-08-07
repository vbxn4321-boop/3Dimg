// ============================================================
// API Route: /api/rembg
// Background removal via remove.bg API
// Fallback: returns original image if API key not set
// ============================================================

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiKey = process.env.REMBG_API_KEY;

    if (!apiKey) {
      // Fallback: Return original image as base64
      console.warn("[RemBg] No API key — returning original image");
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      return NextResponse.json({
        success: true,
        imageBase64: base64,
        mimeType: file.type,
        backgroundRemoved: false,
        message: "Background removal skipped (no API key)",
      });
    }

    // Call remove.bg API
    const rbgFormData = new FormData();
    rbgFormData.append("image_file", file);
    rbgFormData.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: rbgFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[RemBg] remove.bg API error: ${errorText} — falling back to original image`);
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      return NextResponse.json({
        success: true,
        imageBase64: base64,
        mimeType: file.type,
        backgroundRemoved: false,
        message: "Background removal failed, using original image",
      });
    }

    const resultBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(resultBuffer).toString("base64");

    return NextResponse.json({
      success: true,
      imageBase64: base64,
      mimeType: "image/png",
      backgroundRemoved: true,
    });
  } catch (error) {
    console.error("[RemBg] Error:", error);
    return NextResponse.json(
      { error: "Background removal failed", details: String(error) },
      { status: 500 }
    );
  }
}
