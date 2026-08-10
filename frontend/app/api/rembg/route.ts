// ============================================================
// API Route: /api/rembg
// Background removal pipeline:
//   1. remove.bg paid API (if REMBG_API_KEY is set)
//   2. HuggingFace free public Spaces via Gradio Client
//   3. Returns original image as fallback (client will apply canvas matting)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

// Verified public HuggingFace Spaces with their correct endpoints
// The endpoint names were confirmed from live error messages / gradio API discovery
const HF_REMBG_SPACES: Array<{ id: string; api: string; fnIndex?: number }> = [
  // not-lain has a multi-tab UI; /image is the rembg tab endpoint
  { id: "not-lain/background-removal", api: "/image",   fnIndex: 0 },
  { id: "not-lain/background-removal", api: "/png",     fnIndex: 1 },
  { id: "ECCV2022/dis-background-removal",  api: "/predict", fnIndex: 0 },
  { id: "doevent/dis-background-removal",   api: "/predict", fnIndex: 0 },
];

async function removeWithHuggingFace(file: File): Promise<string | null> {
  for (const { id, api, fnIndex } of HF_REMBG_SPACES) {
    try {
      console.log(`[RemBg] Trying HuggingFace Space: ${id} (${api})`);
      const app = await Client.connect(id);

      // Try named endpoint first, fall back to fn_index if needed
      let result: any;
      try {
        result = await app.predict(api, [file]);
      } catch (namedErr: any) {
        if (fnIndex !== undefined && namedErr?.message?.includes("No endpoint matching")) {
          console.warn(`[RemBg] Named endpoint '${api}' failed, trying fn_index=${fnIndex}`);
          result = await app.predict(fnIndex, [file]);
        } else {
          throw namedErr;
        }
      }

      // Parse result — Gradio 5 returns FileData objects
      const output = result?.data?.[0] ?? null;
      if (!output) continue;

      // Case 1: URL string
      if (typeof output === "string" && output.startsWith("http")) {
        const imgRes = await fetch(output);
        const buf = await imgRes.arrayBuffer();
        return Buffer.from(buf).toString("base64");
      }

      // Case 2: Gradio FileData object {url, path, ...}
      if (typeof output === "object") {
        const url: string | undefined = output?.url ?? output?.path;
        if (url) {
          const resolved = url.startsWith("http") ? url : `https://huggingface.co${url}`;
          const imgRes = await fetch(resolved);
          const buf = await imgRes.arrayBuffer();
          return Buffer.from(buf).toString("base64");
        }
        // Inline base64 data
        if (output?.data && typeof output.data === "string") {
          const b64 = output.data.includes(",") ? output.data.split(",")[1] : output.data;
          return b64;
        }
      }
    } catch (err: any) {
      console.warn(`[RemBg] HuggingFace Space '${id}' (${api}) failed:`, err?.message || err);
      continue;
    }
  }
  return null;
}


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // --- Priority 1: remove.bg paid API ---
    const apiKey = process.env.REMBG_API_KEY;
    if (apiKey) {
      try {
        const rbgFormData = new FormData();
        rbgFormData.append("image_file", file);
        rbgFormData.append("size", "auto");

        const response = await fetch("https://api.remove.bg/v1.0/removebg", {
          method: "POST",
          headers: { "X-Api-Key": apiKey },
          body: rbgFormData,
        });

        if (response.ok) {
          const resultBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(resultBuffer).toString("base64");
          return NextResponse.json({
            success: true,
            imageBase64: base64,
            mimeType: "image/png",
            backgroundRemoved: true,
            provider: "remove.bg",
          });
        } else {
          const errorText = await response.text();
          console.warn(`[RemBg] remove.bg API error: ${errorText}`);
        }
      } catch (err) {
        console.warn("[RemBg] remove.bg API call failed:", err);
      }
    }

    // --- Priority 2: HuggingFace free public Spaces ---
    try {
      const base64 = await removeWithHuggingFace(file);
      if (base64) {
        return NextResponse.json({
          success: true,
          imageBase64: base64,
          mimeType: "image/png",
          backgroundRemoved: true,
          provider: "huggingface",
        });
      }
    } catch (hfErr) {
      console.warn("[RemBg] HuggingFace fallback failed:", hfErr);
    }

    // --- Priority 3: Return original (client canvas matting will handle it) ---
    console.warn("[RemBg] All server-side methods failed — returning original image for client fallback");
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return NextResponse.json({
      success: true,
      imageBase64: base64,
      mimeType: file.type,
      backgroundRemoved: false,
      message: "Server-side removal unavailable, client will apply canvas matting",
    });
  } catch (error) {
    console.error("[RemBg] Error:", error);
    return NextResponse.json(
      { error: "Background removal failed", details: String(error) },
      { status: 500 }
    );
  }
}
