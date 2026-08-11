"use client";

import React, { Suspense, useRef, useState, useMemo, Component, ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  useGLTF,
  Html,
  Center,
} from "@react-three/drei";
import * as THREE from "three";
import { GLTFExporter, RoundedBoxGeometry } from "three-stdlib";
import { Download, RotateCcw, Sun, AlertTriangle, Sparkles } from "lucide-react";
import type { VisionAgentOutput } from "@/lib/types/agentSchema";
import { createCroppedTexture } from "@/lib/three/textureProcessor";
import { generateVisualHullGeometry } from "@/lib/three/visualHullBuilder";
import { extractContourShape } from "@/lib/three/contourExtruder";

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
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
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

  const isGenerating = phase === "generating" || phase === "analyzing";

  return (
    <group ref={groupRef}>
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

// ----- Seamless Solid 3D Product Mesh Generator -----
/** 6개 사진 텍스처를 유격과 구멍 없이 3D 실물 모형으로 이어서 입히는 고화질 3D 메쉬 생성기 (곡면/베벨/원통/알파실루엣/VisualHull 지원) */
function TextureMappedBoxMesh({
  multiViewImages,
  imageBase64,
  visionOutput,
  overrideShapeType,
  overrideBevelRadius,
  onMeshReady,
}: {
  multiViewImages?: Array<{ view: string; base64: string; mimeType: string }>;
  imageBase64?: string | null;
  visionOutput?: VisionAgentOutput | null;
  overrideShapeType?: string | null;
  overrideBevelRadius?: number | null;
  onMeshReady?: (mesh: THREE.Mesh) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const primaryColor = visionOutput?.estimatedColors?.[0] || "#ffffff";
  const bounds = visionOutput?.parametricBounds;
  const tightCrops = visionOutput?.tightCrops;

  const shapeType = (overrideShapeType || bounds?.shapeType || "rounded_box").toLowerCase();
  const bevelRadius = overrideBevelRadius ?? bounds?.bevelRadius ?? 0.08;

  const loader = useMemo(() => new THREE.TextureLoader(), []);

  const findBase64 = (viewKey: string) => {
    const item = multiViewImages?.find((m) => m.view === viewKey && m.base64);
    if (item) return `data:${item.mimeType || "image/png"};base64,${item.base64}`;
    if (viewKey === "front" && imageBase64) return `data:image/png;base64,${imageBase64}`;
    return null;
  };

  const frontData = findBase64("front");
  const backData = findBase64("back") || frontData;
  const leftData = findBase64("left") || frontData;
  const rightData = findBase64("right") || frontData;
  const topData = findBase64("top") || frontData;
  const bottomData = findBase64("bottom") || frontData;

  // 포토그래메트리(Photogrammetry) 원칙 적용: 
  // 스마트폰 렌즈의 시야각/원근 왜곡(Lens Distortion & Perspective Foreshortening)이 자동 보정된 
  // Gemini Vision AI의 정밀 3D 실물 기하학 비율(w, h, d)을 3D 도형 생성의 절대 기준으로 사용합니다.
  const w = Math.max(0.4, bounds?.aspectWidth ?? 1.0);
  const h = Math.max(0.4, bounds?.aspectHeight ?? 1.2);
  const d = Math.max(0.2, bounds?.aspectDepth ?? 0.4);

  const roughness = bounds?.surfaceRoughness ?? 0.25;
  const metalness = bounds?.surfaceMetalness ?? 0.05;

  const materials = useMemo(() => {
    const getFaceAspect = (viewKey: string) => {
      if (viewKey === "front" || viewKey === "back") return w / h;
      if (viewKey === "left" || viewKey === "right") return d / h;
      if (viewKey === "top" || viewKey === "bottom") return w / d;
      return w / h;
    };

    const makeFaceMat = (dataUrl: string | null, viewKey: string) => {
      if (!dataUrl) {
        return new THREE.MeshStandardMaterial({
          color: primaryColor,
          roughness: roughness,
          metalness: metalness,
          side: THREE.DoubleSide,
        });
      }
      const crop = tightCrops?.[viewKey];
      const tex = createCroppedTexture(dataUrl, loader, crop);
      return new THREE.MeshStandardMaterial({
        color: "#ffffff",
        map: tex,
        transparent: false,
        roughness: roughness,
        metalness: metalness,
        side: THREE.DoubleSide,
      });
    };

    if (shapeType === "extruded_polygon") {
      const frontMat = makeFaceMat(frontData, "front");
      const sideMat = new THREE.MeshStandardMaterial({
        color: primaryColor || "#f8fafc",
        roughness: 0.2,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      return [frontMat, sideMat];
    } else if (shapeType === "cylinder") {
      // Cylinder: 0: Side, 1: Top, 2: Bottom
      return [
        makeFaceMat(frontData, "front"),
        makeFaceMat(topData, "top"),
        makeFaceMat(bottomData, "bottom"),
      ];
    } else if (shapeType === "sphere") {
      return makeFaceMat(frontData, "front");
    }

    // Three.js BoxGeometry & RoundedBoxGeometry face mapping:
    // 0: Right (+X), 1: Left (-X), 2: Top (+Y), 3: Bottom (-Y), 4: Front (+Z), 5: Back (-Z)
    return [
      makeFaceMat(rightData, "right"),
      makeFaceMat(leftData, "left"),
      makeFaceMat(topData, "top"),
      makeFaceMat(bottomData, "bottom"),
      makeFaceMat(frontData, "front"),
      makeFaceMat(backData, "back"),
    ];
  }, [frontData, backData, leftData, rightData, topData, bottomData, primaryColor, loader, tightCrops, shapeType]);

  const geometry = useMemo(() => {
    if (shapeType === "extruded_polygon") {
      const shape = extractContourShape(frontData, w, h);
      if (shape) {
        return new THREE.ExtrudeGeometry(shape, {
          depth: d,
          bevelEnabled: true,
          bevelThickness: Math.min(w, h) * 0.08,
          bevelSize: Math.min(w, h) * 0.08,
          bevelSegments: 8,
        });
      }
    }
    if (shapeType === "cylinder") {
      const radius = Math.max(w, d) / 2;
      return new THREE.CylinderGeometry(radius, radius, h, 64);
    }
    if (shapeType === "sphere") {
      const radius = Math.max(w, h, d) / 2;
      return new THREE.SphereGeometry(radius, 64, 64);
    }
    if (shapeType === "box" || bevelRadius <= 0) {
      return new THREE.BoxGeometry(w, h, d);
    }

    // rounded_box / rounded_prism: Rounded corners & smoothed edges
    const maxRadius = Math.min(w, h, d) * 0.35;
    const computedRadius = Math.min(maxRadius, Math.max(0.005, Math.min(w, h, d) * bevelRadius));
    return new RoundedBoxGeometry(w, h, d, 4, computedRadius);
  }, [w, h, d, shapeType, bevelRadius, frontData]);

  React.useEffect(() => {
    if (meshRef.current && onMeshReady) {
      onMeshReady(meshRef.current);
    }
  }, [onMeshReady]);

  return (
    <Center top>
      <mesh ref={meshRef} geometry={geometry} material={materials} castShadow receiveShadow />
    </Center>
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
        <p className="text-sm text-slate-300 font-medium">3D 분석 및 모델링 생성 중...</p>
        <p className="text-xs text-slate-500">Gemini가 6면 공간 비율을 계산하고 있어요</p>
      </div>
    </Html>
  );
}

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
  activeModelSource?: "sketchfab" | "ai" | "photo_box" | null;
  onSourceChange?: (source: "sketchfab" | "ai" | "photo_box") => void;
  onLoadSample?: () => void;
  onGenerateAiModel?: () => void;
  imageBase64?: string | null;
  multiViewImages?: Array<{ view: string; base64: string; mimeType: string }>;
  visionOutput?: VisionAgentOutput | null;
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
  imageBase64,
  multiViewImages,
  visionOutput,
}: ThreeDViewerProps) {
  const [internalSource, setInternalSource] = useState<"sketchfab" | "ai" | "photo_box">("photo_box");
  const [lightPreset, setLightPreset] = useState<"studio" | "bright" | "flat" | "warm">("bright");
  const [brightness, setBrightness] = useState<number>(1.3);
  const [shadowOpacity, setShadowOpacity] = useState<number>(0.25);
  const [showLightControls, setShowLightControls] = useState<boolean>(false);

  // 3D Shape & Bevel Radius Overrides
  const [overrideShape, setOverrideShape] = useState<"rounded_box" | "box" | "cylinder" | "sphere" | null>(null);
  const [overrideBevel, setOverrideBevel] = useState<number | null>(null);

  const controlsRef = useRef<any>(null);
  const activeMeshRef = useRef<THREE.Mesh | null>(null);

  const hasPhotos = Boolean(imageBase64 || (multiViewImages && multiViewImages.length > 0));
  const effectiveSource = activeModelSource ?? (hasPhotos ? "photo_box" : internalSource);

  console.log("[ThreeDViewer] Render cycle status:", {
    phase,
    activeModelSource,
    effectiveSource,
    hasPhotos,
    multiViewCount: multiViewImages?.length || 0,
    modelUrl,
    objectName: visionOutput?.objectName,
  });

  const handleSourceChange = (src: "sketchfab" | "ai" | "photo_box") => {
    setInternalSource(src);
    onSourceChange?.(src);
  };

  const handleReset = () => {
    controlsRef.current?.reset();
  };

  // Export current 3D Mesh to GLB
  const handleDownload = () => {
    if (modelUrl) {
      const a = document.createElement("a");
      a.href = modelUrl;
      a.download = "model.glb";
      a.click();
      return;
    }

    if (activeMeshRef.current) {
      const exporter = new GLTFExporter();
      exporter.parse(
        activeMeshRef.current,
        (gltf) => {
          const blob = new Blob([gltf as ArrayBuffer], { type: "application/octet-stream" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${visionOutput?.objectName || "3d_model"}_6view.glb`;
          link.click();
        },
        (err) => console.error("GLTF Export Error:", err),
        { binary: true }
      );
    }
  };

  const isComplete = phase === "complete";
  const isGenerating = phase === "generating" || phase === "analyzing";
  const isSketchfabVisible = Boolean(sketchfabEmbedUrl && effectiveSource === "sketchfab" && !isGenerating);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden glass-card glow-indigo flex flex-col">
      {/* Header Controls Bar (Unified) */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
        style={{ background: "linear-gradient(to bottom, rgba(8,11,20,0.95) 0%, transparent 100%)" }}
      >
        <div className="flex items-center gap-2">
          {hasPhotos ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>📸 6면 포토그래메트리 3D 실물 모형</span>
            </div>
          ) : (
            <>
              <div
                className={`status-dot ${isGenerating ? "processing" : isComplete ? "active" : ""}`}
                style={{ background: isComplete ? "#10b981" : isGenerating ? "#f59e0b" : "#475569" }}
              />
              <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {isComplete ? "고화질 3D 모델 준비됨" : isGenerating ? "3D 공간 계산 중..." : "사진 업로드 시 3D 생성"}
              </span>
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onLoadSample && !isComplete && !hasPhotos && (
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
          <button className="btn-ghost py-1.5 px-2.5 cursor-pointer" onClick={handleReset} title="뷰 초기화">
            <RotateCcw size={14} />
          </button>
          {isComplete && (
            <button className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1 cursor-pointer shadow-lg shadow-indigo-500/20" onClick={handleDownload}>
              <Download size={13} />
              <span>GLB 3D 파일 다운로드</span>
            </button>
          )}
        </div>
      </div>

      {/* Lighting Control Drawer */}
      {!isSketchfabVisible && showLightControls && (
        <div className="absolute top-14 right-4 z-30 p-3.5 rounded-xl border border-indigo-500/30 bg-slate-950/90 backdrop-blur-md shadow-2xl text-xs space-y-3 w-64 animate-fade-in">
          <div className="flex items-center justify-between font-semibold text-indigo-300 pb-1.5 border-b border-white/10">
            <span>💡 3D 조명 및 음영 조절</span>
            <button onClick={() => setShowLightControls(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>

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
                  className={`py-1 px-2 rounded text-[11px] font-medium border transition-all cursor-pointer ${lightPreset === p.id
                    ? "bg-indigo-600 text-white border-indigo-400"
                    : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

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

          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <label className="text-[11px] text-indigo-300 font-semibold flex items-center gap-1">
              <span>📐 3D 형상 & 곡면 스타일</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: "extruded_polygon", label: "✨ 실루엣 3D" },
                { id: "rounded_box", label: "🧊 둥근 박스" },
                { id: "box", label: "📦 직육면체" },
                { id: "cylinder", label: "🥫 원통형" },
                { id: "sphere", label: "🔮 구형" },
              ].map((s) => {
                const activeShape = (overrideShape || visionOutput?.parametricBounds?.shapeType || "rounded_box").toLowerCase();
                return (
                  <button
                    key={s.id}
                    onClick={() => setOverrideShape(s.id as any)}
                    className={`py-1 px-2 rounded text-[11px] font-medium border transition-all cursor-pointer ${activeShape === s.id
                        ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/30"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                      }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {(overrideShape === "rounded_box" || (!overrideShape && ((visionOutput?.parametricBounds?.shapeType as any) === "rounded_box" || !visionOutput?.parametricBounds?.shapeType))) && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">모서리 둥글기 (Bevel)</span>
                <span className="text-indigo-400 font-mono">
                  {Math.round((overrideBevel ?? visionOutput?.parametricBounds?.bevelRadius ?? 0.08) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.25"
                step="0.01"
                value={overrideBevel ?? visionOutput?.parametricBounds?.bevelRadius ?? 0.08}
                onChange={(e) => setOverrideBevel(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          )}
        </div>
      )}

      {/* LAYER 1: Sketchfab iframe Container */}
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

      {/* LAYER 2: Three.js Canvas Container */}
      <div className={`absolute inset-0 w-full h-full ${!isSketchfabVisible ? "block" : "hidden"}`}>
        <ThreeErrorBoundary onReset={handleReset}>
          <Canvas
            camera={{ position: [0, 0, 3.5], fov: 50 }}
            shadows={{ type: THREE.PCFShadowMap }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
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
            <ambientLight intensity={lightPreset === "flat" ? brightness * 1.5 : brightness * 0.9} />
            <directionalLight
              position={[5, 8, 5]}
              intensity={brightness * (lightPreset === "flat" ? 0.4 : 1.4)}
              castShadow={shadowOpacity > 0}
              shadow-mapSize={[1024, 1024]}
            />
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
              {hasPhotos && (effectiveSource === "photo_box" || !modelUrl || modelUrl.includes("sample-shoe")) ? (
                <TextureMappedBoxMesh
                  multiViewImages={multiViewImages}
                  imageBase64={imageBase64}
                  visionOutput={visionOutput}
                  overrideShapeType={overrideShape}
                  overrideBevelRadius={overrideBevel}
                  onMeshReady={(mesh) => { activeMeshRef.current = mesh; }}
                />
              ) : isComplete && modelUrl && !modelUrl.includes("sample-shoe") ? (
                <GLBModel url={modelUrl} />
              ) : (
                <PlaceholderMesh phase={phase} />
              )}
            </Suspense>

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
