// ============================================================
// Vision Agent - Fast 6-View 3D Spatial Geometry Analyzer
// AntiGravity Multi-Agent Pipeline (Google Gemini)
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  VisionAgentInput,
  VisionAgentOutput,
  AgentError,
} from "@/lib/types/agentSchema";

const SYSTEM_PROMPT = `You are an expert Photogrammetry 3D Vision AI.
Your task is to analyze up to 6 view images of a physical product (front, back, left, right, top, bottom), perform spatial feature extraction, and return a clean 3D mesh specification.

CRITICAL INSTRUCTIONS:
1. **Tight Crop Bounding Boxes (tightCrops)**: For EACH view, detect the tight bounding box [minX, minY, maxX, maxY] in normalized 0.0-1.0 coordinates that contains ONLY the main product object.
   - EXCLUDE any human hands, fingers, desk surfaces, or background padding.
2. **3D Aspect Ratios**: Compute the exact X (aspectWidth), Y (aspectHeight), Z (aspectDepth) 3D scale ratios across all views.
3. **Corner Curvature (bevelRadius)**: Estimate the rounded corner curvature radius (e.g. 0.15 for AirPods case, 0.05 for wallet, 0.0 for sharp box).

Return JSON matching this EXACT schema:
{
  "objectName": "<Object name in Korean>",
  "primaryMaterial": "<Main material in Korean>",
  "estimatedColors": ["#ffffff"],
  "confidence": 0.95,
  "parametricBounds": {
    "shapeType": "box",
    "aspectWidth": 1.0,
    "aspectHeight": 1.2,
    "aspectDepth": 0.4,
    "bevelRadius": 0.12
  },
  "tightCrops": {
    "front": [0.1, 0.1, 0.9, 0.9],
    "back": [0.1, 0.1, 0.9, 0.9],
    "left": [0.2, 0.1, 0.8, 0.9],
    "right": [0.2, 0.1, 0.8, 0.9],
    "top": [0.1, 0.2, 0.9, 0.8],
    "bottom": [0.1, 0.2, 0.9, 0.8]
  }
}

Respond ONLY with valid JSON. No markdown code blocks.`;

const MOCK_VISION_OUTPUT: VisionAgentOutput = {
  objectName: "3D 아이템",
  primaryMaterial: "플라스틱",
  estimatedColors: ["#ffffff"],
  hiddenAreas: [],
  styleKeywords: ["Photogrammetry"],
  confidence: 0.95,
  rawDescription: "포토그래메트리 3D 크롭 분석 완료",
  parametricBounds: {
    shapeType: "box",
    aspectWidth: 1.0,
    aspectHeight: 1.2,
    aspectDepth: 0.4,
    bevelRadius: 0.12,
  },
  tightCrops: {},
};

const MODEL_CANDIDATES = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
];

async function callVisionLLM(input: VisionAgentInput): Promise<VisionAgentOutput> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.includes("YOUR_") || apiKey.trim() === "") {
    console.warn("[VisionAgent] No Gemini API key — using default 3D photogrammetry bounds");
    return MOCK_VISION_OUTPUT;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const contentParts: any[] = [SYSTEM_PROMPT];

  if (Array.isArray(input.multiViewImages) && input.multiViewImages.length > 0) {
    const validViews = input.multiViewImages.filter(v => v.view !== "composite_grid");
    validViews.forEach((v) => {
      contentParts.push({
        inlineData: {
          data: v.base64,
          mimeType: (v.mimeType || "image/png") as any,
        },
      });
      contentParts.push(`View angle: ${v.view}`);
    });
    contentParts.push(`Extract tightCrops [minX, minY, maxX, maxY] excluding hands/background and compute 3D aspect ratios X:Y:Z across all ${validViews.length} views.`);
  } else {
    contentParts.push({
      inlineData: {
        data: input.imageBase64,
        mimeType: input.mimeType,
      },
    });
    contentParts.push("Extract tightCrop bounding box and 3D aspect ratios for this object.");
  }

  let lastError: unknown = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      console.log(`[VisionAgent] Photogrammetry 3D analysis with Gemini '${modelName}'...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(contentParts);

      const raw = result.response.text();
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const rawW = Math.max(0.1, Number(parsed.parametricBounds?.aspectWidth ?? parsed.aspectWidth) || 1.0);
      const rawH = Math.max(0.1, Number(parsed.parametricBounds?.aspectHeight ?? parsed.aspectHeight) || 1.2);
      const rawD = Math.max(0.1, Number(parsed.parametricBounds?.aspectDepth ?? parsed.aspectDepth) || 0.4);
      const maxDim = Math.max(rawW, rawH, rawD);

      const output: VisionAgentOutput = {
        objectName: parsed.objectName || "3D 아이템",
        primaryMaterial: parsed.primaryMaterial || "플라스틱",
        estimatedColors: Array.isArray(parsed.estimatedColors) ? parsed.estimatedColors : ["#ffffff"],
        hiddenAreas: [],
        styleKeywords: ["Photogrammetry"],
        confidence: Number(parsed.confidence) || 0.95,
        rawDescription: `${parsed.objectName || "3D 아이템"} 포토그래메트리 정밀 크롭 분석 완료`,
        parametricBounds: {
          shapeType: "box",
          aspectWidth: rawW / maxDim,
          aspectHeight: rawH / maxDim,
          aspectDepth: rawD / maxDim,
          bevelRadius: Number(parsed.parametricBounds?.bevelRadius) || 0.1,
        },
        tightCrops: parsed.tightCrops || {},
      };

      console.log(`[VisionAgent] Photogrammetry Success: W=${output.parametricBounds!.aspectWidth.toFixed(2)}, H=${output.parametricBounds!.aspectHeight.toFixed(2)}, D=${output.parametricBounds!.aspectDepth.toFixed(2)}, tightCrops keys: ${Object.keys(output.tightCrops!).join(", ")}`);
      return output;
    } catch (err: any) {
      console.warn(`[VisionAgent] Model '${modelName}' failed:`, err?.message || err);
      lastError = err;
      continue;
    }
  }

  console.error("[VisionAgent] All Gemini models failed — returning fallback 3D bounds");
  return MOCK_VISION_OUTPUT;
}

export async function runVisionAgent(
  input: VisionAgentInput
): Promise<{ output: VisionAgentOutput | null; error: AgentError | null }> {
  try {
    const output = await callVisionLLM(input);
    return { output, error: null };
  } catch (e) {
    return { output: null, error: e as AgentError };
  }
}
