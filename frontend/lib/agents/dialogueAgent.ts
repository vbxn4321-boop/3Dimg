// ============================================================
// Dialogue Agent - Conversational 3D Specification Refinement
// AntiGravity Multi-Agent Pipeline (Google Gemini)
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  VisionAgentOutput,
  DialogueAgentInput,
  DialogueAgentOutput,
  DialogueQuestion,
  CollectedData,
  Message,
  AgentError,
} from "@/lib/types/agentSchema";

// ----- Structured question flow (3-4 turns) -----
function buildQuestionFlow(vision: VisionAgentOutput): DialogueQuestion[] {
  const questions: DialogueQuestion[] = [];

  // Q1: Hidden/back areas (always ask)
  if (vision.hiddenAreas.length > 0) {
    questions.push({
      id: "hidden_areas",
      category: "hidden_area",
      question: `**${vision.objectName}**의 정면은 명확히 보이지만, 다음 부분은 숨겨져 있어 확인하기 어렵네요: ${vision.hiddenAreas.slice(0, 2).join(", ")}. 이 영역들의 디자인을 직접 설명해 주시겠어요, 아니면 일반적인 **${vision.styleKeywords[0] ?? "표준"}** 스타일로 추정하여 제작할까요?`,
      suggestions: [
        "기본 표준 스타일로 생성해줘",
        "대칭형 디자인으로 유지해줘",
        "직접 설명할게요...",
      ],
    });
  }

  // Q2: Material detail
  questions.push({
    id: "material_detail",
    category: "material",
    question: `주요 재질은 **${vision.primaryMaterial}**(으)로 보입니다. 3D 모델의 표면 질감이나 광택을 조정하시겠어요?`,
    suggestions: [
      `현재 ${vision.primaryMaterial} 그대로 유지`,
      "매트(무광) 느낌으로 변경",
      "광택(유광) 느낌 강조",
      "미세한 입자/질감 추가",
    ],
  });

  // Q3: Style & purpose
  questions.push({
    id: "style_purpose",
    category: "style",
    question: `**${vision.styleKeywords.join(", ")}** 스타일의 느낌이 납니다. 이 3D 모델의 주요 사용 목적은 무엇인가요? 목적에 맞춰 디테일 수준을 최적화해 드릴게요.`,
    suggestions: [
      "게임 에셋 (최적화, Low-Poly)",
      "제품 시각화 (고화질 디테일)",
      "3D 프린팅 (솔리드, 출력용)",
      "애니메이션/VFX (영화급 품질)",
    ],
  });

  // Q4: Additional details (optional)
  questions.push({
    id: "additional_details",
    category: "detail",
    question: `생성 준비가 거의 다 되었습니다! 치수, 로고/브랜딩, 노후화 효과 등 추가하고 싶은 특별한 디테일이 있으신가요?`,
    suggestions: [
      "없습니다, 바로 3D 생성 시작하기!",
      "리얼한 빈티지/노후화 효과 추가",
      "새 제품처럼 깔끔하고 깨끗하게",
      "특정 세부 요구사항이 있어요...",
    ],
  });

  return questions;
}

// ----- Mock dialogue for development -----
function getMockDialogueResponse(
  turnCount: number,
  questions: DialogueQuestion[],
  currentData: CollectedData,
  conversationHistory: Message[] = []
): DialogueAgentOutput {
  const isComplete = turnCount >= questions.length;
  const nextQuestion = isComplete ? null : questions[turnCount];

  const updatedData: CollectedData = {
    ...currentData,
    userAnswers: { ...(currentData?.userAnswers || {}) },
  };

  // Map previous turn user answer to specific collectedData fields
  const lastUserMsg = [...conversationHistory].reverse().find((m) => m.role === "user");
  if (lastUserMsg && turnCount > 0) {
    const prevQ = questions[turnCount - 1];
    if (prevQ) {
      updatedData.userAnswers[prevQ.id] = lastUserMsg.content;
      if (prevQ.id === "hidden_areas") updatedData.backSideDescription = lastUserMsg.content;
      if (prevQ.id === "material_detail") updatedData.materialDetail = lastUserMsg.content;
      if (prevQ.id === "style_purpose") updatedData.styleGuide = lastUserMsg.content;
      if (prevQ.id === "additional_details") {
        updatedData.additionalDetails = [...(updatedData.additionalDetails || []), lastUserMsg.content];
      }
    }
  }

  const messages = [
    "좋습니다! 업로드하신 이미지를 분석하고 주요 특징을 파악했습니다. 더욱 정확한 3D 모델 생성을 위해 몇 가지 질문을 드릴게요.",
    "네, 좋습니다! 보이지 않는 부분은 표준적인 디자인 규칙에 맞춰 세심하게 추정할게요. 다음으로 표면 질감에 대해 이야기해 볼까요?",
    "탁월한 선택입니다! 고화질 시각화용 3D 모델에 맞춰 세부 디테일을 준비하겠습니다. 3D 생성 전 마지막 확인입니다...",
    "멋집니다! 필요한 모든 스펙 정보가 수집되었습니다. 3D 모델 생성을 시작할 준비가 완료되었습니다!",
  ];

  return {
    nextQuestion,
    isComplete,
    assistantMessage: messages[Math.min(turnCount, messages.length - 1)],
    collectedData: updatedData,
  };
}

// ----- System prompt builder -----
function buildSystemPrompt(vision: VisionAgentOutput, turnCount: number): string {
  return `You are a friendly and expert 3D asset specification assistant for the 3Dimg platform.

## Object Being Analyzed
- **Name**: ${vision.objectName}
- **Material**: ${vision.primaryMaterial}
- **Style**: ${vision.styleKeywords.join(", ")}
- **Hidden Areas**: ${vision.hiddenAreas.join(", ")}
- **Colors**: ${vision.estimatedColors.join(", ")}

## Your Role
You are helping the user refine the 3D generation specification through a short, focused conversation in Korean (${turnCount} questions so far, target 3-4 total).

## Guidelines
- ALWAYS communicate and ask questions in natural, polite KOREAN (한국어)
- Be warm, concise, and professional
- Reference the specific object details above in Korean
- Acknowledge the user's previous answers naturally in Korean
- Ask ONE focused question at a time in Korean
- If the user says "generate", "바로 생성", "좋아요" or indicates they're done, set isComplete to true
- Keep messages under 3 sentences in natural Korean

## Response Format
Always respond with valid JSON (no markdown code blocks):
{
  "assistantMessage": "한국어로 작성된 자연스러운 응답 메시지",
  "isComplete": false,
  "collectedData": {
    "materialDetail": "사용자가 설정하거나 답한 표면 재질 (or null)",
    "styleGuide": "사용자가 선택한 스타일/목적 (or null)",
    "backSideDescription": "가려진 부분/뒷면에 대한 사용자 설명 (or null)",
    "additionalDetails": ["사용자가 언급한 기타 세부사항"],
    "userAnswers": { "질문ID": "사용자답변" }
  }
}`;
}

// Models confirmed working for this API key (tested 2026-08)
const MODEL_CANDIDATES = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
];

// ----- History sanitizer for Gemini API -----
function sanitizeHistoryForGemini(messages: Message[]) {
  const filtered = messages.filter((m) => m.role !== "system");
  const result: { role: "user" | "model"; parts: { text: string }[] }[] = [];

  for (const msg of filtered) {
    const role = msg.role === "assistant" ? "model" : "user";
    if (result.length > 0 && result[result.length - 1].role === role) {
      result[result.length - 1].parts[0].text += "\n\n" + msg.content;
    } else {
      result.push({ role, parts: [{ text: msg.content }] });
    }
  }

  // Gemini requires non-empty history to start with a 'user' turn
  if (result.length > 0 && result[0].role === "model") {
    result.shift();
  }

  return result;
}

// ----- Real Dialogue Agent call using Gemini -----
async function callDialogueLLM(
  input: DialogueAgentInput,
  questions: DialogueQuestion[]
): Promise<DialogueAgentOutput> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.includes("YOUR_") || apiKey.trim() === "") {
    console.warn("[DialogueAgent] No Gemini API key — returning mock response");
    await new Promise((r) => setTimeout(r, 800));
    const mockRes = getMockDialogueResponse(
      input.turnCount,
      questions,
      input.collectedData ?? { userAnswers: {} },
      input.conversationHistory
    );
    if (input.turnCount === 0) {
      const greetingHeader = `🎯 **${input.visionOutput.objectName}**을(를) 발견했어요!\n**${input.visionOutput.primaryMaterial}** 재질, **${input.visionOutput.styleKeywords.join(", ")}** 스타일로 분석됐습니다.\n\n`;
      mockRes.assistantMessage = greetingHeader + mockRes.assistantMessage;
    }
    return mockRes;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const isComplete = input.turnCount >= questions.length;
  const nextQuestion = isComplete ? null : questions[input.turnCount];

  // Convert conversation history to clean, alternating Gemini format
  const history = sanitizeHistoryForGemini(input.conversationHistory);

  const nextInstruction = nextQuestion
    ? `다음 질문을 자연스러운 한국어로 친절하게 작성해주세요: "${nextQuestion.question}". 질문 내용을 자연스럽게 맥락에 녹여 다정하게 전달하고, JSON 형식으로만 응답하세요.`
    : `사용자가 필요한 정보를 모두 제공했거나 3D 생성을 원합니다. 따뜻하게 대화를 마무리하고 3D 모델을 생성할 준비가 완료되었음을 한국어로 확인해 주세요. isComplete를 true로 설정하고, JSON 형식으로만 응답하세요.`;

  let lastError: unknown = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      console.log(`[DialogueAgent] Calling Gemini model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildSystemPrompt(input.visionOutput, input.turnCount),
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(nextInstruction);
      const raw = result.response.text();

      // Strip markdown code blocks if present
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        const parsed = JSON.parse(cleaned);
        let assistantMessage = parsed.assistantMessage || raw;
        if (input.turnCount === 0) {
          const greetingHeader = `🎯 **${input.visionOutput.objectName}**을(를) 발견했어요!\n**${input.visionOutput.primaryMaterial}** 재질, **${input.visionOutput.styleKeywords.join(", ")}** 스타일로 분석됐습니다.\n\n`;
          assistantMessage = greetingHeader + assistantMessage;
        }
        return {
          ...parsed,
          assistantMessage,
          nextQuestion,
          isComplete: parsed.isComplete || isComplete,
          collectedData: parsed.collectedData || input.collectedData || { userAnswers: {} },
        };
      } catch {
        let assistantMessage = raw;
        if (input.turnCount === 0) {
          const greetingHeader = `🎯 **${input.visionOutput.objectName}**을(를) 발견했어요!\n**${input.visionOutput.primaryMaterial}** 재질, **${input.visionOutput.styleKeywords.join(", ")}** 스타일로 분석됐습니다.\n\n`;
          assistantMessage = greetingHeader + assistantMessage;
        }
        return {
          nextQuestion,
          isComplete,
          assistantMessage,
          collectedData: input.collectedData || { userAnswers: {} },
        };
      }
    } catch (err: any) {
      console.warn(`[DialogueAgent] Model '${modelName}' error:`, err?.message || err);
      lastError = err;
      continue;
    }
  }

  console.error("[DialogueAgent] All Gemini model attempts failed, falling back to mock response");
  const fallbackRes = getMockDialogueResponse(
    input.turnCount,
    questions,
    input.collectedData ?? { userAnswers: {} },
    input.conversationHistory
  );
  if (input.turnCount === 0) {
    const greetingHeader = `🎯 **${input.visionOutput.objectName}**을(를) 발견했어요!\n**${input.visionOutput.primaryMaterial}** 재질, **${input.visionOutput.styleKeywords.join(", ")}** 스타일로 분석됐습니다.\n\n`;
    fallbackRes.assistantMessage = greetingHeader + fallbackRes.assistantMessage;
  }
  return fallbackRes;
}

// ----- Public interface -----
export async function runDialogueAgent(
  input: DialogueAgentInput
): Promise<{ output: DialogueAgentOutput | null; error: AgentError | null }> {
  try {
    const questions = buildQuestionFlow(input.visionOutput);
    const output = await callDialogueLLM(input, questions);
    return { output, error: null };
  } catch (e) {
    return { output: null, error: e as AgentError };
  }
}

// ----- 3D Prompt Builder (runs after dialogue complete) -----
export function build3DPrompt(
  vision: VisionAgentOutput,
  collected: CollectedData
): string {
  const base = `High quality 3D model of ${vision.objectName}`;
  const material = `Material: ${collected.materialDetail || vision.primaryMaterial}`;
  const style = collected.styleGuide
    ? `Style: ${collected.styleGuide}`
    : `Style: ${vision.styleKeywords.join(", ")}`;
  const colors = `Primary colors: ${vision.estimatedColors.join(", ")}`;
  const details = collected.additionalDetails?.join(", ") || "";
  const back = collected.backSideDescription
    ? `Back detail: ${collected.backSideDescription}`
    : "";

  return [base, material, style, colors, back, details]
    .filter(Boolean)
    .join(". ");
}
