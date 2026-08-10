"use client";

import React, { Suspense, useRef, useState, useMemo, Component, ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useGLTF,
  Html,
  Center,
} from "@react-three/drei";
import * as THREE from "three";
import { Download, RotateCcw, ZoomIn, ZoomOut, Sun, Moon, AlertTriangle, Sparkles } from "lucide-react";

// ----- Error Boundary to prevent React white screen crashes -----
interface ErrorBoundaryProps {
  fallback?: ReactNode;
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ThreeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[3DViewer ErrorBoundary Caught]:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle size={32} className="text-amber-400" />
            <p className="text-sm font-semibold text-slate-200">3D 렌더링 중 오류가 발생했습니다</p>
            <p className="text-xs text-slate-400 max-w-xs">
              브라우저 WebGL 또는 모델 로딩에 문제가 있습니다.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onReset?.();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              다시 시도
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

// ----- Animated placeholder mesh -----
function PlaceholderMesh({ phase }: { phase: string }) {
  const groupRef = useRef<THREE.Group>(null!);
  const cubeRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.rotation.y = t * 0.4;
    if (cubeRef.current) cubeRef.current.position.y = Math.sin(t * 1.2) * 0.08;
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.8;
      ringRef.current.rotation.z = t * 0.5;
    }
  });

  const isGenerating = phase === "generating";

  return (
    <group ref={groupRef}>
      {/* Core cube */}
      <mesh ref={cubeRef} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={isGenerating ? "#a855f7" : "#6366f1"}
          metalness={0.8}
          roughness={0.2}
          emissive={isGenerating ? "#7c3aed" : "#4338ca"}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Orbit ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1.4, 0.02, 16, 100]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#9333ea"
          emissiveIntensity={0.6}
          metalness={1}
          roughness={0}
        />
      </mesh>

      {/* Corner spheres */}
      {[
        [0.7, 0.7, 0.7],
        [-0.7, 0.7, -0.7],
        [0.7, -0.7, -0.7],
        [-0.7, -0.7, 0.7],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial
            color="#ec4899"
            emissive="#db2777"
            emissiveIntensity={1}
          />
        </mesh>
      ))}
    </group>
  );
}

// ----- GLB model loader -----
function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  return (
    <Center top>
      <primitive object={clonedScene} />
    </Center>
  );
}

// Preload sample GLB for instant rendering
useGLTF.preload("/models/sample-shoe.glb");

// ----- Loading overlay -----
function LoadingOverlay({ progress }: { progress: number }) {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative w-16 h-16">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="rgba(99,102,241,0.2)"
              strokeWidth="4"
            />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="url(#grad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-indigo-400">
            {progress}%
          </span>
        </div>
        <p className="text-sm text-slate-300 font-medium">3D 모델 생성 중...</p>
        <p className="text-xs text-slate-500">AI가 열심히 만들고 있어요</p>
      </div>
    </Html>
  );
}

// ----- Model Loading Fallback -----
function GLBLoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 text-center p-4 rounded-xl" style={{ background: "rgba(8,11,20,0.85)", backdropFilter: "blur(10px)" }}>
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-300 font-medium">3D 에셋 로딩 중...</p>
      </div>
    </Html>
  );
}

// ----- Main Viewer Component -----
interface ThreeDViewerProps {
  modelUrl?: string;
  sketchfabEmbedUrl?: string;
  sketchfabViewerUrl?: string;
  sketchfabModelName?: string;
  phase: string;
  generationProgress?: number;
  activeModelSource?: "sketchfab" | "ai" | null;
  onSourceChange?: (source: "sketchfab" | "ai") => void;
  onLoadSample?: () => void;
  onGenerateAiModel?: () => void;
}

export default function ThreeDViewer({
  modelUrl,
  sketchfabEmbedUrl,
  sketchfabViewerUrl,
  sketchfabModelName,
  phase,
  generationProgress = 0,
  activeModelSource,
  onSourceChange,
  onLoadSample,
  onGenerateAiModel,
}: ThreeDViewerProps) {
  const [internalSource, setInternalSource] = useState<"sketchfab" | "ai">("sketchfab");
  const [lightPreset, setLightPreset] = useState<"studio" | "bright" | "flat" | "warm">("bright");
  const [brightness, setBrightness] = useState<number>(1.3);
  const [shadowOpacity, setShadowOpacity] = useState<number>(0.25);
  const [showLightControls, setShowLightControls] = useState<boolean>(false);
  const controlsRef = useRef<any>(null);

  const effectiveSource = activeModelSource ?? internalSource;

  const handleSourceChange = (src: "sketchfab" | "ai") => {
    setInternalSource(src);
    onSourceChange?.(src);
  };

  const handleReset = () => {
    controlsRef.current?.reset();
  };

  const handleDownload = () => {
    if (!modelUrl) return;
    const a = document.createElement("a");
    a.href = modelUrl;
    a.download = "model.glb";
    a.click();
  };

  const isComplete = phase === "complete" && (modelUrl || sketchfabEmbedUrl);
  const isGenerating = phase === "generating";

  // Determines whether Sketchfab view should be visible
  const isSketchfabVisible = Boolean(sketchfabEmbedUrl && effectiveSource === "sketchfab" && !isGenerating);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden glass-card glow-indigo flex flex-col">
      {/* Header Controls Bar (Unified) */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
        style={{ background: "linear-gradient(to bottom, rgba(8,11,20,0.95) 0%, transparent 100%)" }}
      >
        <div className="flex items-center gap-2">
          {sketchfabEmbedUrl ? (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10 backdrop-blur-md">
              <button
                onClick={() => handleSourceChange("sketchfab")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSketchfabVisible
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <span>📦 Sketchfab DB 모델</span>
              </button>

              <button
                onClick={() => {
                  handleSourceChange("ai");
                  if (!modelUrl && onGenerateAiModel) {
                    onGenerateAiModel();
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  !isSketchfabVisible
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <Sparkles size={12} className="text-amber-400" />
                <span>{modelUrl ? "✨ AI 생성 3D 모델" : "✨ AI로 새로 생성하기"}</span>
              </button>
            </div>
          ) : (
            <>
              <div
                className={`status-dot ${isGenerating ? "processing" : isComplete ? "active" : ""}`}
                style={{ background: isComplete ? "#10b981" : isGenerating ? "#f59e0b" : "#475569" }}
              />
              <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {isComplete ? "AI 3D 모델 준비됨" : isGenerating ? "AI 3D 모델 생성 중..." : "대화 완료 시 3D 생성"}
              </span>
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isSketchfabVisible ? (
            <a
              href={sketchfabViewerUrl || sketchfabEmbedUrl?.replace("/embed?autostart=1&autospin=0.5&ui_theme=dark&ui_infos=0&ui_controls=0&ui_watermark=0", "").replace("https://sketchfab.com/models/", "https://sketchfab.com/3d-models/")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-500/20"
            >
              <Download size={13} />
              <span>3D 파일 다운로드</span>
            </a>
          ) : (
            <>
              {onLoadSample && !isComplete && (
                <button
                  className="btn-ghost py-1.5 px-3 text-xs"
                  onClick={onLoadSample}
                  style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
                >
                  샘플 3D 미리보기
                </button>
              )}
              <button
                className={`btn-ghost py-1.5 px-2.5 text-xs flex items-center gap-1.5 ${showLightControls ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50" : ""}`}
                onClick={() => setShowLightControls(!showLightControls)}
                title="조명 및 음영 조절"
              >
                <Sun size={14} />
                <span>조명 조절</span>
              </button>
              <button className="btn-ghost py-1.5 px-2.5" onClick={handleReset} title="뷰 초기화">
                <RotateCcw size={14} />
              </button>
              {isComplete && modelUrl && (
                <button className="btn-primary py-1.5 px-3 text-xs" onClick={handleDownload}>
                  <Download size={12} />
                  GLB 다운로드
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Choice Pending Overlay when user has not yet chosen in ChatPanel */}
      {activeModelSource === null && sketchfabEmbedUrl && !isGenerating && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30">
            <Sparkles size={24} className="text-amber-400 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">3D 모델 준비 완료!</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              왼쪽 대화창에서 원하시는 3D 방식을 선택하시면 즉시 화면에 표시됩니다 💬
            </p>
          </div>
        </div>
      )}

      {/* Lighting Control Panel Drawer */}
      {!isSketchfabVisible && showLightControls && (
        <div className="absolute top-14 right-4 z-30 p-3.5 rounded-xl border border-indigo-500/30 bg-slate-950/90 backdrop-blur-md shadow-2xl text-xs space-y-3 w-64 animate-fade-in">
          <div className="flex items-center justify-between font-semibold text-indigo-300 pb-1.5 border-b border-white/10">
            <span>💡 3D 조명 및 음영 조절</span>
            <button onClick={() => setShowLightControls(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">조명 프리셋</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: "bright", label: "☀️ 소프트 맑음" },
                { id: "flat", label: "💡 무음영 평면" },
                { id: "studio", label: "🎬 스튜디오" },
                { id: "warm", label: "🌅 따뜻한 석양" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setLightPreset(p.id as any)}
                  className={`py-1 px-2 rounded text-[11px] font-medium border transition-all ${
                    lightPreset === p.id
                      ? "bg-indigo-600 text-white border-indigo-400"
                      : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Brightness Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">조명 밝기</span>
              <span className="text-indigo-400 font-mono">{Math.round(brightness * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={brightness}
              onChange={(e) => setBrightness(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Shadow Opacity Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">바닥 그림자 강도</span>
              <span className="text-indigo-400 font-mono">{Math.round(shadowOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.8"
              step="0.05"
              value={shadowOpacity}
              onChange={(e) => setShadowOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      )}

      {/* LAYER 1: Sketchfab iframe Container (Kept mounted in DOM, toggled via CSS) */}
      {sketchfabEmbedUrl && (
        <div className={`absolute inset-0 w-full h-full ${isSketchfabVisible ? "block" : "hidden"}`}>
          <iframe
            title={sketchfabModelName ?? "3D Model"}
            src={sketchfabEmbedUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; xr-spatial-tracking"
            allowFullScreen
            // @ts-ignore
            credentialless={true}
            style={{ background: "#080b14" }}
          />
        </div>
      )}

      {/* LAYER 2: Three.js Canvas Container (Kept mounted in DOM, toggled via CSS) */}
      <div className={`absolute inset-0 w-full h-full ${!isSketchfabVisible ? "block" : "hidden"}`}>
        <ThreeErrorBoundary onReset={handleReset}>
          <Canvas
            camera={{ position: [0, 0, 3.5], fov: 50 }}
            shadows={{ type: THREE.PCFShadowMap }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
              failIfMajorPerformanceCaveat: false,
            }}
            onCreated={({ gl }) => {
              const canvas = gl.domElement;
              canvas.addEventListener("webglcontextlost", (event) => {
                event.preventDefault();
                console.warn("[3DViewer] WebGL Context Lost — auto-restoring context...");
              });
              canvas.addEventListener("webglcontextrestored", () => {
                console.log("[3DViewer] WebGL Context Restored successfully.");
              });
            }}
            style={{ background: "transparent" }}
          >
            {/* Dynamic 360-Degree Lighting Setup */}
            <ambientLight intensity={lightPreset === "flat" ? brightness * 1.5 : brightness * 0.9} />
            
            {/* Main Key Light */}
            <directionalLight
              position={[5, 8, 5]}
              intensity={brightness * (lightPreset === "flat" ? 0.4 : 1.4)}
              castShadow={shadowOpacity > 0}
              shadow-mapSize={[1024, 1024]}
            />

            {/* Front & Rear Fill Lights (Lift dark shadows from back & sides) */}
            <directionalLight
              position={[-5, -4, -5]}
              intensity={brightness * (lightPreset === "flat" ? 1.0 : 0.7)}
              color={lightPreset === "warm" ? "#fdba74" : "#ffffff"}
            />
            <directionalLight
              position={[0, 5, -5]}
              intensity={brightness * 0.5}
              color={lightPreset === "bright" ? "#e0e7ff" : "#ffffff"}
            />

            {/* Soft Colored Accent Lights */}
            <pointLight
              position={[-4, 3, -4]}
              intensity={brightness * 0.6}
              color={lightPreset === "warm" ? "#f97316" : lightPreset === "studio" ? "#818cf8" : "#ffffff"}
            />
            <pointLight
              position={[4, -2, 4]}
              intensity={brightness * 0.5}
              color={lightPreset === "warm" ? "#fb7185" : lightPreset === "studio" ? "#c084fc" : "#ffffff"}
            />

            {/* Model or Placeholder */}
            <Suspense fallback={isGenerating ? <LoadingOverlay progress={generationProgress} /> : <GLBLoadingFallback />}>
              {isComplete && modelUrl ? (
                <GLBModel url={modelUrl} />
              ) : (
                <PlaceholderMesh phase={phase} />
              )}
            </Suspense>

            {/* Contact shadows */}
            {shadowOpacity > 0 && (
              <ContactShadows
                position={[0, -1.2, 0]}
                opacity={shadowOpacity}
                scale={4}
                blur={2.5}
                far={4}
                color="#475569"
              />
            )}

            {/* Controls */}
            <OrbitControls
              ref={controlsRef}
              enablePan={false}
              minDistance={1.5}
              maxDistance={8}
              autoRotate={!isComplete}
              autoRotateSpeed={1.5}
              makeDefault
            />
          </Canvas>
        </ThreeErrorBoundary>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-10">
        <span
          className="text-xs px-3 py-1 rounded-full"
          style={{
            background: "rgba(8,11,20,0.7)",
            color: "var(--color-text-muted)",
            backdropFilter: "blur(8px)",
          }}
        >
          드래그로 회전 · 스크롤로 줌
        </span>
      </div>
    </div>
  );
}
