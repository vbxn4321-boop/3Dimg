// ============================================================
// 3D Prompt Agent - Synthesizes Vision + Dialogue into 3D Prompts
// AntiGravity Multi-Agent Pipeline
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  VisionAgentOutput,
  CollectedData,
  ThreeDPromptAgentInput,
  ThreeDPromptAgentOutput,
  AgentError,
} from "@/lib/types/agentSchema";

const PROMPT_AGENT_SYSTEM_PROMPT = `You are an expert 3D generative AI prompt engineer.
Your task is to take 2D vision analysis data and dialogue specifications, and synthesize them into optimized prompts and parameters for 3D generation engines (such as Tripo3D or Meshy).

Respond ONLY with a valid JSON object matching this structure (no markdown code blocks):
{
  "positivePrompt": "Detailed positive prompt for 3D model generation, high detail, PBR materials, game ready/product visualization",
  "negativePrompt": "low poly, distorted, blurry, extra limbs, bad geometry, overlapping faces, untextured",
  "style": "Extracted style (e.g., modern, realistic, low-poly, stylized)",
  "material": "Extracted PBR material specification",
  "generationParams": {
    "quality": "high",
    "topology": "quads",
    "targetPolyCount": 25000,
    "textureResolution": 2048,
    "generateNormalMap": true,
    "generateRoughnessMap": true
  },
  "estimatedGenTime": 45
}`;

const MODEL_CANDIDATES = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
];

// Fallback rule-based prompt generator
export function buildRuleBasedPrompt(
  vision: VisionAgentOutput,
  collected: CollectedData
): ThreeDPromptAgentOutput {
  const parts: string[] = [];
  parts.push(`High quality 3D model of ${vision.objectName}`);

  if (collected.materialDetail || vision.primaryMaterial) {
    parts.push(`Material: ${collected.materialDetail || vision.primaryMaterial}`);
  }

  if (collected.styleGuide || vision.styleKeywords.length > 0) {
    parts.push(`Style: ${collected.styleGuide || vision.styleKeywords.join(", ")}`);
  }

  if (vision.estimatedColors.length > 0) {
    parts.push(`Colors: ${vision.estimatedColors.join(", ")}`);
  }

  if (collected.backSideDescription) {
    parts.push(`Hidden/Back area details: ${collected.backSideDescription}`);
  }

  if (collected.additionalDetails?.length) {
    parts.push(`Additional details: ${collected.additionalDetails.join(", ")}`);
  }

  parts.push("PBR textures, 8k resolution, clean quad topology, studio lighting");

  return {
    positivePrompt: parts.join(". "),
    negativePrompt:
      "low quality, distorted geometry, floating vertices, bad UVs, blurry textures, broken normals, hole in mesh",
    style: collected.styleGuide || vision.styleKeywords[0] || "realistic",
    material: collected.materialDetail || vision.primaryMaterial || "standard PBR",
    generationParams: {
      quality: "high",
      topology: "quads",
      targetPolyCount: 30000,
      textureResolution: 2048,
      generateNormalMap: true,
      generateRoughnessMap: true,
    },
    estimatedGenTime: 30,
  };
}

async function callPromptLLM(
  input: ThreeDPromptAgentInput
): Promise<ThreeDPromptAgentOutput> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.includes("YOUR_") || apiKey.trim() === "") {
    console.warn("[PromptAgent] No Gemini API key — using rule-based generator");
    return buildRuleBasedPrompt(input.visionOutput, input.collectedData);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const promptContext = `
Analyze these specifications and generate 3D generation parameters:
- Object Name: ${input.visionOutput.objectName}
- Primary Material: ${input.visionOutput.primaryMaterial}
- Style Keywords: ${input.visionOutput.styleKeywords.join(", ")}
- Hidden Area Notes: ${input.collectedData?.backSideDescription || input.visionOutput.hiddenAreas.join(", ")}
- User Material Preference: ${input.collectedData?.materialDetail || "default"}
- User Style/Purpose Choice: ${input.collectedData?.styleGuide || "default"}
- User Additional Notes: ${input.collectedData?.additionalDetails?.join(", ") || "none"}
`;

  let lastError: unknown = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      console.log(`[PromptAgent] Calling Gemini model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: PROMPT_AGENT_SYSTEM_PROMPT,
      });

      const result = await model.generateContent(promptContext);
      const raw = result.response.text();
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        return JSON.parse(cleaned) as ThreeDPromptAgentOutput;
      } catch {
        const fallback = buildRuleBasedPrompt(input.visionOutput, input.collectedData);
        fallback.positivePrompt = raw;
        return fallback;
      }
    } catch (err: any) {
      console.warn(`[PromptAgent] Model '${modelName}' error:`, err?.message || err);
      lastError = err;
      continue;
    }
  }

  console.error("[PromptAgent] All Gemini models failed — using rule-based generator");
  return buildRuleBasedPrompt(input.visionOutput, input.collectedData);
}

export async function runPromptAgent(
  input: ThreeDPromptAgentInput
): Promise<{ output: ThreeDPromptAgentOutput | null; error: AgentError | null }> {
  try {
    const output = await callPromptLLM(input);
    return { output, error: null };
  } catch (e) {
    return { output: null, error: e as AgentError };
  }
}
