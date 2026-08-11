"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot, Sparkles, Loader2, Zap } from "lucide-react";
import type { Message, VisionAgentOutput, CollectedData, DialogueAgentOutput } from "@/lib/types/agentSchema";

interface ChatPanelProps {
  visionOutput: VisionAgentOutput | null;
  onComplete: (collectedData: CollectedData) => void;
  isAnalyzing?: boolean;
  sketchfabModelName?: string;
  showChoice?: boolean;
  activeModelSource?: "sketchfab" | "ai" | "photo_box" | null;
  onSelectSketchfab?: () => void;
  onSelectAiGen?: () => void;
}

export default function ChatPanel({
  visionOutput,
  onComplete,
  isAnalyzing,
  sketchfabModelName,
  showChoice,
  activeModelSource,
  onSelectSketchfab,
  onSelectAiGen,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [collectedData, setCollectedData] = useState<CollectedData>({ userAnswers: {} });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const currentVisionRef = useRef<VisionAgentOutput | null>(null);

  // Start dialogue when vision analysis is complete or visionOutput changes
  useEffect(() => {
    if (visionOutput && visionOutput !== currentVisionRef.current) {
      currentVisionRef.current = visionOutput;
      setMessages([]);
      setTurnCount(0);
      setCollectedData({ userAnswers: {} });
      setSuggestions([]);
      setIsComplete(false);
      setInput("");
      startDialogue(visionOutput);
    }
  }, [visionOutput]);

  const startDialogue = async (vision: VisionAgentOutput) => {
    setIsLoading(true);
    const initialData: CollectedData = { userAnswers: {} };
    await callDialogue([], 0, initialData, vision);
    setIsLoading(false);
  };

  const callDialogue = async (
    history: Message[],
    turn: number,
    data: CollectedData,
    vision: VisionAgentOutput
  ) => {
    try {
      const res = await fetch("/api/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visionOutput: vision,
          conversationHistory: history,
          turnCount: turn,
          collectedData: data,
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const output: DialogueAgentOutput = result.output;

      const aiMessage: Message = {
        role: "assistant",
        content: output.assistantMessage,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setCollectedData(output.collectedData);
      setSuggestions(output.nextQuestion?.suggestions ?? []);

      if (output.isComplete) {
        setIsComplete(true);
        setTimeout(() => onComplete(output.collectedData), 1000);
      }
    } catch (err) {
      console.error("Dialogue error:", err);
    }
  };

  const sendMessage = async (text?: string) => {
    const content = text ?? input.trim();
    if (!content || isLoading || !visionOutput || isComplete) return;

    setInput("");
    setSuggestions([]);
    setIsLoading(true);

    const userMsg: Message = { role: "user", content, timestamp: Date.now() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);

    const newTurn = turnCount + 1;
    setTurnCount(newTurn);

    await callDialogue(newHistory, newTurn, collectedData, visionOutput);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Analyzing state
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-12 animate-fade-in">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))" }}
        >
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-accent-primary)" }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Vision AI 분석 중...
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            이미지의 재질, 형태, 스타일을 파악하고 있어요
          </p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: "var(--color-accent-primary)",
                animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state (before image upload)
  if (!visionOutput && !isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.15)",
          }}
        >
          <Bot size={24} style={{ color: "var(--color-text-muted)" }} />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
            이미지를 업로드하면
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            AI가 자동으로 분석 후 3D 스펙을 함께 잡아드려요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`animate-fade-in-up delay-${Math.min(i * 100, 400)} ${
              msg.role === "user" ? "flex justify-end" : "flex justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="flex gap-2 items-start max-w-[85%]">
                <div
                  className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{
                    background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3))",
                  }}
                >
                  <Sparkles size={13} style={{ color: "#a5b4fc" }} />
                </div>
                <div className="chat-bubble-ai">
                  {msg.content.split("\n").map((line, j) => (
                    <p
                      key={j}
                      dangerouslySetInnerHTML={{
                        __html: line
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/^🎯|^✅|^💡/g, (m) => `<span class="mr-1">${m}</span>`),
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {msg.role === "user" && (
              <div className="chat-bubble-user">{msg.content}</div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex gap-2 items-center">
              <div
                className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3))" }}
              >
                <Sparkles size={13} style={{ color: "#a5b4fc" }} />
              </div>
              <div className="chat-bubble-ai flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "var(--color-text-muted)",
                      animation: `pulse-dot 1s ease-in-out ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Interactive Choice Card when Sketchfab model is found */}
        {showChoice && (
          <div className="p-3.5 rounded-2xl border border-indigo-500/30 bg-slate-900/90 shadow-xl space-y-3 animate-fade-in-up my-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
              <Sparkles size={14} className="text-amber-400" />
              <span>3D 생성 방식을 선택해 주세요</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              이 제품에 어울리는 완성형 3D 모델을 찾았습니다! 아래 두 가지 방법 중 하나를 선택해 주세요:
            </p>

            <div className="grid grid-cols-1 gap-2 pt-1">
              {/* Option 1: Sketchfab DB Model */}
              <button
                onClick={onSelectSketchfab}
                className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/40 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center justify-between font-semibold text-xs text-emerald-400">
                  <span>📦 Sketchfab 완성형 DB 모델</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 font-bold">추천 (고화질)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                  {sketchfabModelName ? `"${sketchfabModelName}" — ` : ""}실물과 동일한 정교한 디테일의 3D 에셋
                </p>
              </button>

              {/* Option 2: AI Custom Generation */}
              <button
                onClick={onSelectAiGen}
                className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 hover:bg-indigo-900/40 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center justify-between font-semibold text-xs text-indigo-300">
                  <span>✨ AI 맞춤 3D 새로 생성 (TripoSR)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  답변하신 재질, 광택, 스타일 옵션을 직접 반영하여 3D 모델 자동 생성
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Alternative Option Banner when a model is active in viewer */}
        {!showChoice && activeModelSource === "sketchfab" && (
          <div className="p-3.5 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 text-xs space-y-2.5 animate-fade-in-up my-2">
            <div className="flex items-center justify-between text-indigo-300 font-semibold">
              <span className="flex items-center gap-1.5">
                📦 현재 Sketchfab DB 모델 표시 중
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              대화에서 선택한 스타일/재질 스펙을 반영한 AI 생성 3D 모델로 바꾸시겠어요?
            </p>
            <button
              onClick={onSelectAiGen}
              className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>✨ AI 맞춤 3D 모델 새로 생성하기 (TripoSR)</span>
            </button>
          </div>
        )}

        {!showChoice && activeModelSource === "ai" && sketchfabModelName && (
          <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-xs space-y-2.5 animate-fade-in-up my-2">
            <div className="flex items-center justify-between text-emerald-300 font-semibold">
              <span className="flex items-center gap-1.5">
                ✨ 현재 AI 생성 3D 모델 표시 중
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              실물과 똑같은 정교한 완성형 Sketchfab DB 모델로 전환할 수 있습니다.
            </p>
            <button
              onClick={onSelectSketchfab}
              className="w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <span>📦 Sketchfab 완성형 DB 모델로 바꾸기</span>
            </button>
          </div>
        )}

        {isComplete && !showChoice && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg animate-fade-in-up"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
            <p className="text-xs font-medium" style={{ color: "#10b981" }}>
              {activeModelSource ? "🎉 3D 모델 준비가 완료되었습니다!" : "스펙 수집 완료! 3D 생성을 시작합니다..."}
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick 3D Generation Skip Button */}
      {!isComplete && visionOutput && !isLoading && (
        <button
          onClick={() => {
            setIsComplete(true);
            onComplete(collectedData);
          }}
          className="w-full py-2 px-3 my-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md hover:opacity-90 active:scale-[0.99] border border-indigo-400/30 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(168,85,247,0.9) 100%)",
            color: "white",
          }}
        >
          <Zap size={13} />
          대화 생략하고 바로 3D 생성하기 (1초 실행)
        </button>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && !isComplete && (
        <div className="flex flex-wrap gap-1.5 py-2">
          {suggestions.map((s) => (
            <button
              key={s}
              className="suggestion-pill"
              onClick={() => sendMessage(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {!isComplete && visionOutput && (
        <div
          className="flex items-end gap-2 pt-2 mt-2"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <textarea
            ref={inputRef}
            className="input-field flex-1"
            placeholder="답변을 입력하세요... (Enter로 전송)"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            style={{ minHeight: "40px", maxHeight: "100px" }}
          />
          <button
            className="btn-primary py-2.5 px-3 flex-shrink-0"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
