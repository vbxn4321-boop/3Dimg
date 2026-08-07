// ============================================================
// API Route: /api/dialogue  (POST - streaming)
// Runs the Dialogue Agent and streams back the response
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runDialogueAgent } from "@/lib/agents/dialogueAgent";
import type { DialogueAgentInput } from "@/lib/types/agentSchema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { visionOutput, conversationHistory, turnCount, collectedData } = body;

    if (!visionOutput) {
      return NextResponse.json(
        { error: "visionOutput is required" },
        { status: 400 }
      );
    }

    const input: DialogueAgentInput = {
      visionOutput,
      conversationHistory: conversationHistory ?? [],
      turnCount: turnCount ?? 0,
      collectedData: collectedData ?? { userAnswers: {} },
    };

    const { output, error } = await runDialogueAgent(input);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true, output });
  } catch (error) {
    console.error("[Dialogue API] Error:", error);
    return NextResponse.json(
      { error: "Dialogue agent failed", details: String(error) },
      { status: 500 }
    );
  }
}
