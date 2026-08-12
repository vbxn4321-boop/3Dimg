import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParametricBounds } from "@/lib/types/agentSchema";

const SYSTEM_PROMPT = `You are an expert 3D AI Assistant.
Your task is to analyze a user's text prompt describing an object, and translate it into a structured 3D parametric specification.

CRITICAL INSTRUCTIONS:
1. Identify the object's general shape: "rounded_box" (smartphones, cases), "cylinder" (cans, bottles, cups, pens), "sphere" (balls), or "box" (square objects).
2. Estimate the physical aspect ratio (Width : Height : Depth) relative to the largest dimension. Values should be between 0.1 and 1.0. For example, a smartphone might be { W: 0.5, H: 1.0, D: 0.05 }.
3. Estimate surface material properties: roughness (0.0 to 1.0, where 0 is glossy, 1 is matte) and metalness (0.0 to 1.0, where 1 is fully metallic).
4. Extract the primary color in HEX code (e.g., #ef4444). If no color is specified, guess a default color based on the object.

Return JSON matching this EXACT schema:
{
  "objectName": "<Extracted Object Name in Korean>",
  "color": "#HEXCODE",
  "parametricBounds": {
    "shapeType": "rounded_box",
    "aspectWidth": 0.5,
    "aspectHeight": 1.0,
    "aspectDepth": 0.05,
    "bevelRadius": 0.05,
    "surfaceRoughness": 0.2,
    "surfaceMetalness": 0.8
  }
}

Respond ONLY with valid JSON. No markdown code blocks.`;

export async function POST(request: NextRequest) {
  let userPrompt = "";
  try {
    const { prompt, model: requestedModel } = await request.json();
    userPrompt = prompt || "";

    if (!userPrompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.includes("YOUR_") || apiKey.trim() === "") {
      // Fallback for missing API key
      return NextResponse.json({
        objectName: prompt,
        color: "#3b82f6",
        parametricBounds: {
          shapeType: "box",
          aspectWidth: 1.0,
          aspectHeight: 1.0,
          aspectDepth: 1.0,
          bevelRadius: 0.1,
          surfaceRoughness: 0.5,
          surfaceMetalness: 0.1,
        }
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 가능한 모든 Gemini 상위/최신 모델 후보군
    const defaultCandidates = [
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.1-pro",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite",
      "gemini-3.1-lite",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-pro-exp",
      "gemini-2.0-flash-thinking-exp",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ];

    const MODEL_CANDIDATES = requestedModel 
      ? [requestedModel, ...defaultCandidates.filter(m => m !== requestedModel)]
      : defaultCandidates;

    let lastError: any;

    for (const modelName of MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const result = await model.generateContent([
          SYSTEM_PROMPT,
          `User Prompt: "${prompt}"`
        ]);

        const raw = result.response.text();
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);

        return NextResponse.json(parsed);
      } catch (error) {
        console.warn(`[Text-to-3D API] Model ${modelName} failed. Trying next...`, error);
        lastError = error;
      }
    }

    // 모든 AI 모델이 실패했거나 쿼터 초과(429)일 경우 로컬 스마트 추론 Fallback
    throw lastError;
  } catch (error) {
    console.warn("[Text-to-3D API] AI model quota/call failed, using smart local fallback:", error);
    
    // 텍스트 기반 스마트 형태/비율 로컬 추론
    const p = userPrompt.toLowerCase();
    let shapeType = "box";
    let w = 1.0, h = 1.0, d = 1.0;
    let color = "#3b82f6";
    let roughness = 0.4, metalness = 0.3;

    if (p.includes("폰") || p.includes("phone") || p.includes("스마트폰") || p.includes("카드")) {
      shapeType = "rounded_box";
      w = 0.5; h = 1.0; d = 0.06;
      color = "#1e293b"; roughness = 0.1; metalness = 0.9;
    } else if (p.includes("구") || p.includes("공") || p.includes("sphere") || p.includes("ball")) {
      shapeType = "sphere";
      w = 1.0; h = 1.0; d = 1.0;
      color = "#ef4444"; roughness = 0.3; metalness = 0.1;
    } else if (p.includes("원기둥") || p.includes("컵") || p.includes("캔") || p.includes("bottle") || p.includes("cylinder")) {
      shapeType = "cylinder";
      w = 0.5; h = 1.2; d = 0.5;
      color = "#0ea5e9"; roughness = 0.2; metalness = 0.7;
    } else if (p.includes("책상") || p.includes("테이블") || p.includes("의자") || p.includes("box")) {
      shapeType = "box";
      w = 1.5; h = 0.8; d = 1.0;
      color = "#8b5cf6"; roughness = 0.6; metalness = 0.1;
    }

    if (p.includes("빨강") || p.includes("red")) color = "#ef4444";
    if (p.includes("파랑") || p.includes("blue")) color = "#3b82f6";
    if (p.includes("노랑") || p.includes("yellow")) color = "#eab308";
    if (p.includes("초록") || p.includes("green")) color = "#22c55e";
    if (p.includes("검정") || p.includes("black")) color = "#0f172a";
    if (p.includes("하양") || p.includes("white")) color = "#f8fafc";
    if (p.includes("금") || p.includes("gold")) { color = "#eab308"; metalness = 0.9; roughness = 0.1; }

    return NextResponse.json({
      objectName: prompt,
      color: color,
      parametricBounds: {
        shapeType: shapeType,
        aspectWidth: w,
        aspectHeight: h,
        aspectDepth: d,
        bevelRadius: 0.05,
        surfaceRoughness: roughness,
        surfaceMetalness: metalness,
      }
    });
  }
}
