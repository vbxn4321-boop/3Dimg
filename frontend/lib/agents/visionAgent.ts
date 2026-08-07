// ============================================================
// Vision Agent - Image Analysis via Google Gemini
// AntiGravity Multi-Agent Pipeline
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  VisionAgentInput,
  VisionAgentOutput,
  AgentError,
} from "@/lib/types/agentSchema";

const VISION_SYSTEM_PROMPT = `You are an expert 3D asset analyst. Your role is to analyze a 2D product image and extract detailed information in Korean to help recreate it as a high-quality 3D model.

Analyze the image and respond with a JSON object containing:
- objectName: The exact type/name of the object in Korean (be specific, e.g. "스포티 러닝화", "모던 원목 의자")
- primaryMaterial: The dominant material in Korean (e.g., "통기성 메쉬 및 고무", "광택 스테인리스")
- estimatedColors: Array of hex color codes (most dominant first, max 5)
- hiddenAreas: Array of areas NOT visible in the image in Korean (e.g., "뒷면 카운터", "밑창 접지면")
- styleKeywords: Array of style descriptors in Korean (e.g., "스포티", "모던", "경량성")
- confidence: Float 0.0-1.0 for analysis confidence
- rawDescription: A detailed 2-3 sentence description of the object in Korean

Respond ONLY with valid JSON. No markdown code blocks.`;

// ----- Mock data for development without API key -----
const MOCK_VISION_OUTPUT: VisionAgentOutput = {
  objectName: "모던 러닝 스니커즈",
  primaryMaterial: "통기성 메쉬 갑피와 고무 밑창",
  estimatedColors: ["#F5F5F5", "#2563EB", "#1E293B", "#94A3B8"],
  hiddenAreas: [
    "힐 카운터 및 칼라 세부 디테일",
    "인솔 및 아치 지원 구조",
    "아웃솔 접지 패턴",
    "설포 라벨 및 끈 고정부 뒷면",
  ],
  styleKeywords: ["스포티", "모던", "경량성", "고성능"],
  confidence: 0.88,
  rawDescription:
    "경량 메쉬 갑피와 지지력을 향상시키는 오버레이 구조를 갖춘 현대적인 아슬레틱 러닝화입니다. 유선형 실루엣과 쿠셔닝 미드솔이 특징입니다.",
};

// Models confirmed working for this API key (tested 2026-08)
const MODEL_CANDIDATES = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
];

// ----- Real Vision Agent call using Gemini -----
async function callVisionLLM(input: VisionAgentInput): Promise<VisionAgentOutput> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.includes("YOUR_") || apiKey.trim() === "") {
    console.warn("[VisionAgent] No Gemini API key found — returning mock data");
    await new Promise((r) => setTimeout(r, 1500)); // Simulate latency
    return MOCK_VISION_OUTPUT;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const imagePart = {
    inlineData: {
      data: input.imageBase64,
      mimeType: input.mimeType,
    },
  };

  let lastError: unknown = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      console.log(`[VisionAgent] Calling Gemini model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent([
        VISION_SYSTEM_PROMPT,
        imagePart,
        "Analyze this image for 3D asset generation. Return JSON only.",
      ]);

      const raw = result.response.text();
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(cleaned) as VisionAgentOutput;
    } catch (err: any) {
      console.warn(`[VisionAgent] Model '${modelName}' error:`, err?.message || err);
      lastError = err;
      // Continue to next model candidate (404, 429 rate limits, etc.)
      continue;
    }
  }

  console.error("[VisionAgent] All Gemini model attempts failed or rate-limited, falling back to mock data");
  return MOCK_VISION_OUTPUT;
}

// ----- Public interface -----
export async function runVisionAgent(
  input: VisionAgentInput
): Promise<{ output: VisionAgentOutput | null; error: AgentError | null }> {
  try {
    const output = await callVisionLLM(input);
    return { output, error: null };
  } catch (e) {
    const error = e as AgentError;
    return { output: null, error };
  }
}
