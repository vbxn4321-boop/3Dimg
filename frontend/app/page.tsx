"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Zap, Globe, HelpCircle, ChevronRight, Image, MessageSquare } from "lucide-react";
import UploadPanel from "@/components/UploadPanel";
import ChatPanel from "@/components/ChatPanel";
import type { VisionAgentOutput, CollectedData, SessionPhase, ThreeDPromptAgentOutput } from "@/lib/types/agentSchema";

// Dynamic import for Three.js (SSR disabled)
const ThreeDViewer = dynamic(() => import("@/components/ThreeDViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center glass-card">
      <div className="text-center">
        <div
          className="w-12 h-12 rounded-2xl mx-auto mb-3 animate-pulse"
          style={{ background: "rgba(99,102,241,0.2)" }}
        />
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>뷰어 로딩 중...</p>
      </div>
    </div>
  ),
});

function selectModelForVision(objectName: string = ""): string {
  const name = objectName.toLowerCase();
  if (
    name.includes("헬멧") ||
    name.includes("helmet") ||
    name.includes("모자") ||
    name.includes("로봇") ||
    name.includes("의자") ||
    name.includes("단색") ||
    name.includes("배경")
  ) {
    return "/models/sample-helmet.glb";
  }
  if (
    name.includes("오리") ||
    name.includes("duck") ||
    name.includes("캐릭터") ||
    name.includes("인형") ||
    name.includes("동물") ||
    name.includes("장난감")
  ) {
    return "/models/sample-duck.glb";
  }
  return "/models/sample-shoe.glb";
}

type LeftTab = "upload" | "chat";

export default function HomePage() {
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [leftTab, setLeftTab] = useState<LeftTab>("upload");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [visionOutput, setVisionOutput] = useState<VisionAgentOutput | null>(null);
  const [modelUrl, setModelUrl] = useState<string | undefined>();
  const [sketchfabEmbedUrl, setSketchfabEmbedUrl] = useState<string | undefined>();
  const [sketchfabViewerUrl, setSketchfabViewerUrl] = useState<string | undefined>();
  const [sketchfabModelName, setSketchfabModelName] = useState<string | undefined>();
  const [genProgress, setGenProgress] = useState(0);
  const [promptMetadata, setPromptMetadata] = useState<ThreeDPromptAgentOutput | null>(null);
  const [lastCollectedData, setLastCollectedData] = useState<CollectedData | null>(null);
  const [showChoiceModal, setShowChoiceModal] = useState<boolean>(false);
  const [activeModelSource, setActiveModelSource] = useState<"sketchfab" | "ai" | null>(null);
  const [pendingSketchfabData, setPendingSketchfabData] = useState<{
    embedUrl: string;
    viewerUrl: string;
    modelName: string;
  } | null>(null);

  // 1. Image uploaded & background removed
  const handleImageReady = useCallback(async (
    base64: string,
    mime: string,
    bgRemoved: boolean,
    previewUrl: string
  ) => {
    setImageBase64(base64);
    setImageMime(mime);
    setImagePreviewUrl(previewUrl);
    setVisionOutput(null);
    setModelUrl(undefined);
    setSketchfabEmbedUrl(undefined);
    setSketchfabViewerUrl(undefined);
    setSketchfabModelName(undefined);
    setPendingSketchfabData(null);
    setActiveModelSource(null);
    setShowChoiceModal(false);
    setPromptMetadata(null);
    setGenProgress(0);
    setPhase("analyzing");
    setLeftTab("chat");

    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: mime, backgroundRemoved: bgRemoved }),
      });
      const data = await res.json();
      if (data.success) {
        setVisionOutput(data.output);
        setPhase("chatting");
      } else {
        setPhase("error");
      }
    } catch {
      setPhase("error");
    }
  }, []);

  // 2. Dialogue complete → trigger 3D generation API pipeline
  const handleDialogueComplete = useCallback(async (collectedData: CollectedData) => {
    setLastCollectedData(collectedData);
    setPhase("generating");

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 4;
      if (progress >= 90) {
        setGenProgress(90);
      } else {
        setGenProgress(Math.round(progress));
      }
    }, 400);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visionOutput,
          collectedData,
          imageBase64,
          mimeType: imageMime,
        }),
      });

      const data = await res.json();
      clearInterval(interval);

      if (data.success) {
        setGenProgress(100);
        if (data.promptMetadata) {
          setPromptMetadata(data.promptMetadata);
        }
        // Sketchfab embed found: set embed URL to preload in background layer, present choice card in chat window
        if (data.provider === "sketchfab" && data.sketchfabEmbedUrl) {
          setSketchfabEmbedUrl(data.sketchfabEmbedUrl);
          setSketchfabViewerUrl(data.sketchfabViewerUrl);
          setSketchfabModelName(data.sketchfabModelName);
          setModelUrl(undefined);
          setShowChoiceModal(true);
          setActiveModelSource(null); // Keep activeModelSource null so viewer shows choice overlay while preloading
          setPhase("complete");
        } else if (data.modelUrl) {
          setModelUrl(data.modelUrl);
          setSketchfabEmbedUrl(undefined);
          setSketchfabViewerUrl(undefined);
          setActiveModelSource("ai");
          setPhase("complete");
        } else {
          const dynamicModel = selectModelForVision(visionOutput?.objectName);
          setModelUrl(dynamicModel);
          setSketchfabEmbedUrl(undefined);
          setSketchfabViewerUrl(undefined);
          setActiveModelSource("ai");
          setPhase("complete");
        }
      } else {
        setPhase("error");
      }
    } catch {
      clearInterval(interval);
      setPhase("error");
    }
  }, [visionOutput, imageBase64, imageMime]);

  // 3. User requests custom AI 3D model generation (forceAiGen: true)
  const handleGenerateAiModel = useCallback(async () => {
    if (!visionOutput) return;
    setPhase("generating");
    setGenProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 4;
      if (progress >= 90) {
        setGenProgress(90);
      } else {
        setGenProgress(Math.round(progress));
      }
    }, 400);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visionOutput,
          collectedData: lastCollectedData,
          imageBase64,
          mimeType: imageMime,
          forceAiGen: true,
        }),
      });

      const data = await res.json();
      clearInterval(interval);

      if (data.success) {
        setGenProgress(100);
        if (data.promptMetadata) {
          setPromptMetadata(data.promptMetadata);
        }
        if (data.modelUrl) {
          setModelUrl(data.modelUrl);
        } else {
          const dynamicModel = selectModelForVision(visionOutput?.objectName);
          setModelUrl(dynamicModel);
        }
        setPhase("complete");
      } else {
        setPhase("error");
      }
    } catch {
      clearInterval(interval);
      setPhase("error");
    }
  }, [visionOutput, lastCollectedData, imageBase64, imageMime]);

  const handleSelectSketchfab = useCallback(() => {
    setActiveModelSource("sketchfab");
    setShowChoiceModal(false);
    setPhase("complete");
  }, []);

  const handleSelectAiGen = useCallback(() => {
    setShowChoiceModal(false);
    setActiveModelSource("ai");
    setPhase("complete");
    if (!modelUrl) {
      handleGenerateAiModel();
    }
  }, [modelUrl, handleGenerateAiModel]);

  const steps = [
    { id: 1, label: "이미지 업로드", done: phase !== "idle" },
    { id: 2, label: "AI 질의응답", done: phase === "generating" || phase === "complete" },
    { id: 3, label: "3D 생성", done: phase === "complete" },
  ];

  const handleLoadSample = useCallback(() => {
    setModelUrl("/models/sample-shoe.glb");
    setPhase("complete");
  }, []);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--color-bg-primary)" }}
    >
      {/* ====== Header ====== */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-6 py-3 z-20"
        style={{
          background: "rgba(8,11,20,0.9)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
          >
            <Zap size={16} color="white" />
          </div>
          <div>
            <h1 className="text-base font-bold gradient-text">3Dimg</h1>
            <p className="text-xs" style={{ color: "var(--color-text-muted)", lineHeight: 1 }}>
              by AntiGravity
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="hidden md:flex items-center gap-1">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: step.done
                    ? "rgba(99,102,241,0.15)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${step.done ? "rgba(99,102,241,0.3)" : "var(--color-border)"}`,
                  color: step.done ? "#a5b4fc" : "var(--color-text-muted)",
                }}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                  style={{
                    background: step.done ? "#6366f1" : "rgba(255,255,255,0.08)",
                    color: step.done ? "white" : "var(--color-text-muted)",
                  }}
                >
                  {step.id}
                </span>
                {step.label}
              </div>
              {i < steps.length - 1 && (
                <ChevronRight size={12} style={{ color: "var(--color-text-muted)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button className="btn-ghost py-1.5 px-2.5">
            <HelpCircle size={15} />
            <span className="hidden sm:inline text-xs">도움말</span>
          </button>
          <button className="btn-ghost py-1.5 px-2.5">
            <Globe size={15} />
          </button>
        </div>
      </header>

      {/* ====== Main Split View ====== */}
      <div className="flex flex-1 min-h-0 gap-4 p-4">

        {/* ---- Left Panel ---- */}
        <div
          className="flex flex-col glass-card overflow-hidden"
          style={{ width: "380px", flexShrink: 0 }}
        >
          {/* Tab bar */}
          <div
            className="flex-shrink-0 flex border-b"
            style={{ borderColor: "var(--color-border)" }}
          >
            {[
              { id: "upload" as LeftTab, label: "이미지", icon: Image },
              { id: "chat" as LeftTab, label: "AI 대화", icon: MessageSquare },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setLeftTab(id)}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all"
                style={{
                  color: leftTab === id ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  borderBottom: leftTab === id ? "2px solid var(--color-accent-primary)" : "2px solid transparent",
                  background: leftTab === id ? "rgba(99,102,241,0.05)" : "transparent",
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Uploaded image thumbnail strip */}
          {imagePreviewUrl && (
            <div
              className="flex-shrink-0 flex items-center gap-3 px-4 py-2"
              style={{ borderBottom: "1px solid var(--color-border)", background: "rgba(255,255,255,0.02)" }}
            >
              <div
                className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <img src={imagePreviewUrl} alt="업로드된 이미지" className="w-full h-full object-contain" />
              </div>
              {visionOutput && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                    {visionOutput.objectName}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                    {visionOutput.primaryMaterial}
                  </p>
                </div>
              )}
              {visionOutput?.estimatedColors && (
                <div className="ml-auto flex gap-1 flex-shrink-0">
                  {visionOutput.estimatedColors.slice(0, 4).map((c) => (
                    <div
                      key={c}
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: c, borderColor: "rgba(255,255,255,0.1)" }}
                      title={c}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0 flex flex-col justify-between">
            <div className="flex-1 min-h-0 flex flex-col">
              <div className={leftTab === "upload" ? "h-full flex flex-col" : "hidden"}>
                <UploadPanel
                  onImageReady={handleImageReady}
                  isProcessing={phase === "analyzing"}
                />
              </div>
              <div className={leftTab === "chat" ? "h-full flex flex-col" : "hidden"}>
                <ChatPanel
                  visionOutput={visionOutput}
                  onComplete={handleDialogueComplete}
                  isAnalyzing={phase === "analyzing"}
                  sketchfabModelName={sketchfabModelName}
                  showChoice={showChoiceModal}
                  activeModelSource={activeModelSource}
                  onSelectSketchfab={handleSelectSketchfab}
                  onSelectAiGen={handleSelectAiGen}
                />
              </div>
            </div>

            {promptMetadata && phase === "complete" && (
              <div className="mt-3 p-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20 text-xs space-y-1.5 animate-fade-in flex-shrink-0">
                <div className="flex items-center justify-between font-semibold text-indigo-300">
                  <span>✨ 3D 프롬프트 합성 완료</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200">
                    {promptMetadata.generationParams.topology || "Quads"} · {promptMetadata.generationParams.targetPolyCount?.toLocaleString() || "25,000"} Polys
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] line-clamp-2 leading-relaxed">
                  <strong className="text-indigo-400">Prompt:</strong> {promptMetadata.positivePrompt}
                </p>
                <div className="flex gap-2 text-[10px] text-slate-400 pt-1 border-t border-indigo-500/10">
                  <span>재질: {promptMetadata.material}</span>
                  <span>·</span>
                  <span>스타일: {promptMetadata.style}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---- Right Panel: 3D Viewer ---- */}
        <div className="flex-1 min-w-0 min-h-0">
          <ThreeDViewer
            modelUrl={modelUrl}
            sketchfabEmbedUrl={sketchfabEmbedUrl}
            sketchfabViewerUrl={sketchfabViewerUrl}
            sketchfabModelName={sketchfabModelName}
            phase={phase}
            generationProgress={genProgress}
            activeModelSource={activeModelSource}
            onSourceChange={setActiveModelSource}
            onLoadSample={handleLoadSample}
            onGenerateAiModel={handleGenerateAiModel}
          />
        </div>
      </div>
    </div>
  );
}
