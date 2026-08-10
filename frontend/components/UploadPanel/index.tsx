"use client";

import { useCallback, useState } from "react";
import { Upload, ImagePlus, X, CheckCircle, Loader2, Scissors, Eraser, Camera, Layers, Sparkles } from "lucide-react";
import { processImageBackground } from "@/lib/utils/removeBackground";
import CutoutEditorModal from "@/components/CutoutEditorModal";

export type ViewKey = "front" | "back" | "left" | "right" | "top" | "bottom";

export interface ViewSlotState {
  key: ViewKey;
  label: string;
  required: boolean;
  file: File | null;
  originalPreview: string | null;
  processedPreview: string | null;
  base64: string | null;
  mimeType: string;
  status: "idle" | "uploading" | "removing_bg" | "ready";
}

interface UploadPanelProps {
  onImageReady: (
    imageBase64: string,
    mimeType: string,
    backgroundRemoved: boolean,
    previewUrl: string,
    multiViewImages?: Array<{ view: string; base64: string; mimeType: string }>
  ) => void;
  isProcessing?: boolean;
}

const VIEW_SLOTS_INIT: ViewSlotState[] = [
  { key: "front", label: "정면 (Front)", required: true, file: null, originalPreview: null, processedPreview: null, base64: null, mimeType: "image/png", status: "idle" },
  { key: "back", label: "후면 (Back)", required: false, file: null, originalPreview: null, processedPreview: null, base64: null, mimeType: "image/png", status: "idle" },
  { key: "left", label: "좌측 (Left)", required: false, file: null, originalPreview: null, processedPreview: null, base64: null, mimeType: "image/png", status: "idle" },
  { key: "right", label: "우측 (Right)", required: false, file: null, originalPreview: null, processedPreview: null, base64: null, mimeType: "image/png", status: "idle" },
  { key: "top", label: "상단 (Top)", required: false, file: null, originalPreview: null, processedPreview: null, base64: null, mimeType: "image/png", status: "idle" },
  { key: "bottom", label: "하단 (Bottom)", required: false, file: null, originalPreview: null, processedPreview: null, base64: null, mimeType: "image/png", status: "idle" },
];

async function createMultiViewGridComposite(
  slots: ViewSlotState[]
): Promise<{ gridBase64: string; previewUrl: string }> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const cellSize = 512;
    canvas.width = cellSize * 3;  // 1536px
    canvas.height = cellSize * 2; // 1024px

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      const front = slots.find((s) => s.key === "front");
      resolve({ gridBase64: front?.base64 || "", previewUrl: front?.processedPreview || "" });
      return;
    }

    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const layout: Record<ViewKey, { col: number; row: number }> = {
      front: { col: 0, row: 0 },
      back: { col: 1, row: 0 },
      left: { col: 2, row: 0 },
      right: { col: 0, row: 1 },
      top: { col: 1, row: 1 },
      bottom: { col: 2, row: 1 },
    };

    const activeSlots = slots.filter((s) => s.processedPreview);
    if (activeSlots.length === 0) {
      resolve({ gridBase64: "", previewUrl: "" });
      return;
    }

    let loadedCount = 0;
    activeSlots.forEach((slot) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const { col, row } = layout[slot.key];
        const x = col * cellSize;
        const y = row * cellSize;

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(x + 4, y + 4, cellSize - 8, cellSize - 8);

        const scale = Math.min((cellSize - 32) / img.width, (cellSize - 32) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const offsetX = x + (cellSize - w) / 2;
        const offsetY = y + (cellSize - h) / 2;

        ctx.drawImage(img, offsetX, offsetY, w, h);

        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(x + 8, y + 8, 120, 24);
        ctx.fillStyle = "#a5b4fc";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(slot.label, x + 14, y + 24);

        loadedCount++;
        if (loadedCount === activeSlots.length) {
          const dataUrl = canvas.toDataURL("image/png");
          resolve({ gridBase64: dataUrl.split(",")[1], previewUrl: dataUrl });
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === activeSlots.length) {
          const dataUrl = canvas.toDataURL("image/png");
          resolve({ gridBase64: dataUrl.split(",")[1], previewUrl: dataUrl });
        }
      };
      img.src = slot.processedPreview!;
    });
  });
}

export default function UploadPanel({ onImageReady, isProcessing }: UploadPanelProps) {
  const [uploadMode, setUploadMode] = useState<"single" | "multiview">("single");

  // Single mode state
  const [isDragging, setIsDragging] = useState(false);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "removing_bg" | "ready">("idle");
  const [fileName, setFileName] = useState<string>("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Multi-view mode state
  const [viewSlots, setViewSlots] = useState<ViewSlotState[]>(VIEW_SLOTS_INIT);
  const [editingSlotKey, setEditingSlotKey] = useState<ViewKey | null>(null);

  // ----- Single Image Processing -----
  const processSingleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    setFileName(file.name);
    setStatus("uploading");

    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setStatus("removing_bg");

    try {
      const result = await processImageBackground(file);
      const processedDataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
      setProcessedPreview(processedDataUrl);
      setStatus("ready");
      onImageReady(result.imageBase64, result.mimeType, result.backgroundRemoved, processedDataUrl);
    } catch (err) {
      console.error("Upload error:", err);
      const fallbackBase64 = await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res((fr.result as string).split(",")[1]);
        fr.readAsDataURL(file);
      });
      const previewUrl = `data:${file.type};base64,${fallbackBase64}`;
      setProcessedPreview(previewUrl);
      setStatus("ready");
      onImageReady(fallbackBase64, file.type as any, false, previewUrl);
    }
  }, [onImageReady]);

  // ----- Multi-View Slot File Processing -----
  const processSlotFile = async (key: ViewKey, file: File) => {
    if (!file.type.startsWith("image/")) return;

    // Set slot uploading
    setViewSlots((prev) =>
      prev.map((slot) =>
        slot.key === key ? { ...slot, file, status: "removing_bg" } : slot
      )
    );

    const reader = new FileReader();
    reader.onload = (e) => {
      const origUrl = e.target?.result as string;
      setViewSlots((prev) =>
        prev.map((slot) => (slot.key === key ? { ...slot, originalPreview: origUrl } : slot))
      );
    };
    reader.readAsDataURL(file);

    try {
      const result = await processImageBackground(file);
      const processedDataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;

      setViewSlots((prev) =>
        prev.map((slot) =>
          slot.key === key
            ? {
                ...slot,
                processedPreview: processedDataUrl,
                base64: result.imageBase64,
                mimeType: result.mimeType,
                status: "ready" as const,
              }
            : slot
        )
      );
    } catch (err) {
      console.error(`Error processing view [${key}]:`, err);
      const fallbackBase64 = await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res((fr.result as string).split(",")[1]);
        fr.readAsDataURL(file);
      });
      const previewUrl = `data:${file.type};base64,${fallbackBase64}`;

      setViewSlots((prev) =>
        prev.map((slot) =>
          slot.key === key
            ? {
                ...slot,
                processedPreview: previewUrl,
                base64: fallbackBase64,
                mimeType: file.type,
                status: "ready" as const,
              }
            : slot
        )
      );
    }
  };

  // Trigger 3D analysis when user clicks submit button in Multi-View mode
  const handleStartMultiViewAnalysis = async () => {
    const frontSlot = viewSlots.find((s) => s.key === "front");
    if (!frontSlot || !frontSlot.base64 || !frontSlot.processedPreview) return;

    // Create 2x3 combined multi-view grid canvas image for Gemini Vision AI analysis
    const activeSlots = viewSlots.filter((s) => s.processedPreview);
    let compositeGridBase64: string | undefined = undefined;

    if (activeSlots.length > 1) {
      try {
        const composite = await createMultiViewGridComposite(viewSlots);
        if (composite.gridBase64) {
          compositeGridBase64 = composite.gridBase64;
        }
      } catch (cErr) {
        console.warn("[UploadPanel] Grid composite failed:", cErr);
      }
    }

    const multiViewPayload = viewSlots
      .filter((s) => s.base64)
      .map((s) => ({ view: s.key, base64: s.base64!, mimeType: s.mimeType }));

    if (compositeGridBase64) {
      multiViewPayload.push({
        view: "composite_grid" as ViewKey,
        base64: compositeGridBase64,
        mimeType: "image/png",
      });
    }

    // Always pass clean frontSlot object cutout (NOT the grid layout with text labels) to 3D AI generator!
    onImageReady(
      frontSlot.base64,
      frontSlot.mimeType || "image/png",
      true,
      frontSlot.processedPreview,
      multiViewPayload
    );
  };

  // Handle single mode cutout edit save
  const handleSingleEditedSave = (editedBase64: string, previewUrl: string) => {
    setProcessedPreview(previewUrl);
    onImageReady(editedBase64, "image/png", true, previewUrl);
  };

  // Handle slot mode cutout edit save
  const handleSlotEditedSave = (editedBase64: string, previewUrl: string) => {
    if (!editingSlotKey) return;
    setViewSlots((prev) => {
      const updated = prev.map((slot) =>
        slot.key === editingSlotKey
          ? { ...slot, base64: editedBase64, processedPreview: previewUrl }
          : slot
      );

      const frontSlot = updated.find((s) => s.key === "front");
      if (frontSlot && frontSlot.base64 && frontSlot.processedPreview) {
        const multiViewPayload = updated
          .filter((s) => s.base64)
          .map((s) => ({ view: s.key, base64: s.base64!, mimeType: s.mimeType }));

        onImageReady(
          frontSlot.base64,
          frontSlot.mimeType,
          true,
          frontSlot.processedPreview,
          multiViewPayload
        );
      }
      return updated;
    });
  };

  const handleDropSingle = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processSingleFile(file);
  }, [processSingleFile]);

  const handleResetSingle = () => {
    setOriginalPreview(null);
    setProcessedPreview(null);
    setStatus("idle");
    setFileName("");
  };

  const activeEditingSlot = viewSlots.find((s) => s.key === editingSlotKey);

  return (
    <div className="flex flex-col gap-3">
      {/* Upload Mode Selector Bar */}
      <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-white/10 text-xs">
        <button
          onClick={() => setUploadMode("single")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            uploadMode === "single"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Camera size={13} />
          <span>단일 사진 모드</span>
        </button>

        <button
          onClick={() => setUploadMode("multiview")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            uploadMode === "multiview"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Layers size={13} />
          <span>6각도 멀티뷰 (스캔급)</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">PRO</span>
        </button>
      </div>

      {/* ================= MODE 1: SINGLE IMAGE UPLOAD ================= */}
      {uploadMode === "single" && (
        <>
          {status === "ready" && processedPreview ? (
            <div className="flex flex-col gap-3 animate-fade-in">
              <CutoutEditorModal
                isOpen={isEditorOpen}
                originalImageUrl={originalPreview ?? processedPreview}
                currentCutoutUrl={processedPreview}
                onClose={() => setIsEditorOpen(false)}
                onSave={handleSingleEditedSave}
              />

              <div className="grid grid-cols-2 gap-2">
                {originalPreview && (
                  <div className="relative">
                    <p className="text-xs mb-1.5 text-slate-400">원본</p>
                    <div className="rounded-lg overflow-hidden aspect-square border border-white/10 bg-slate-900">
                      <img src={originalPreview} alt="원본" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
                <div className="relative">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Scissors size={11} className="text-emerald-400" />
                    <p className="text-xs font-medium text-emerald-400">배경 제거 결과</p>
                  </div>
                  <div
                    className="rounded-lg overflow-hidden aspect-square border border-emerald-500/30"
                    style={{
                      backgroundImage: "repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%)",
                      backgroundSize: "16px 16px",
                    }}
                  >
                    <img src={processedPreview} alt="배경제거" className="w-full h-full object-contain" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setIsEditorOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer border border-indigo-400/30"
                >
                  <Eraser size={14} />
                  <span>✏️ 누끼 직접 수정하기 (지우개 / 복원 브러시)</span>
                </button>

                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-emerald-400 truncate">{fileName}</span>
                  </div>
                  <button onClick={handleResetSingle} className="p-1 rounded hover:bg-white/10 text-slate-400">
                    <X size={14} />
                  </button>
                </div>

                <button
                  onClick={handleResetSingle}
                  className="w-full py-2 px-3 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/5 text-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus size={13} />
                  다른 이미지 업로드 / 변경하기
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {status === "removing_bg" ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl py-10 bg-indigo-950/20 border border-indigo-500/20">
                  <Loader2 size={28} className="animate-spin text-indigo-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-200">배경 제거 중...</p>
                    <p className="text-xs mt-1 text-slate-400">AI가 이미지를 분석하고 있어요</p>
                  </div>
                </div>
              ) : (
                <label
                  className={`upload-zone flex flex-col items-center justify-center gap-4 py-10 px-4 cursor-pointer ${isDragging ? "drag-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDropSingle}
                  htmlFor="file-upload-single"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center animate-float"
                    style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))",
                      border: "1px solid rgba(99,102,241,0.3)",
                    }}
                  >
                    <ImagePlus size={24} className="text-indigo-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-200">이미지를 드래그하거나 클릭하세요</p>
                    <p className="text-xs mt-1 text-slate-400">PNG, JPG, WebP 지원 · 최대 10MB</p>
                  </div>
                  <input
                    id="file-upload-single"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processSingleFile(f);
                    }}
                  />
                </label>
              )}
            </div>
          )}
        </>
      )}

      {/* ================= MODE 2: 6-ANGLE MULTI-VIEW UPLOAD ================= */}
      {uploadMode === "multiview" && (
        <div className="flex flex-col gap-3 animate-fade-in">
          {/* Modal for active editing slot */}
          {activeEditingSlot && (
            <CutoutEditorModal
              isOpen={Boolean(editingSlotKey)}
              originalImageUrl={activeEditingSlot.originalPreview ?? activeEditingSlot.processedPreview!}
              currentCutoutUrl={activeEditingSlot.processedPreview!}
              onClose={() => setEditingSlotKey(null)}
              onSave={handleSlotEditedSave}
            />
          )}

          <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs space-y-1">
            <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <Layers size={13} className="text-indigo-400" />
              <span>6개 각도 멀티뷰 정밀 3D 스캔 모드</span>
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              정면 사진은 필수이며, 각도를 많이 업로드할수록 보이지 않는 뒷면과 옆면까지 스캔급으로 100% 정교하게 생성됩니다.
            </p>
          </div>

          {/* 6 View Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {viewSlots.map((slot) => {
              const isReady = slot.status === "ready" && slot.processedPreview;
              const isLoading = slot.status === "removing_bg" || slot.status === "uploading";

              return (
                <div
                  key={slot.key}
                  className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    isReady
                      ? "border-emerald-500/40 bg-emerald-950/20"
                      : slot.required
                      ? "border-indigo-500/40 bg-indigo-950/20"
                      : "border-white/10 bg-slate-900/50 hover:bg-slate-900"
                  }`}
                >
                  <div className="w-full flex items-center justify-between mb-1.5 text-[11px] font-semibold">
                    <span className={slot.required ? "text-indigo-300 font-bold" : "text-slate-300"}>
                      {slot.label}
                    </span>
                    {slot.required && (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px]">필수</span>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="w-full aspect-square rounded-lg flex flex-col items-center justify-center gap-1.5 bg-slate-950/50">
                      <Loader2 size={20} className="animate-spin text-indigo-400" />
                      <span className="text-[10px] text-slate-400">누끼 제거 중...</span>
                    </div>
                  ) : isReady ? (
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-emerald-500/30 group">
                      <div
                        className="w-full h-full"
                        style={{
                          backgroundImage: "repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%)",
                          backgroundSize: "12px 12px",
                        }}
                      >
                        <img src={slot.processedPreview!} alt={slot.label} className="w-full h-full object-contain" />
                      </div>

                      {/* Slot Overlay Actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-1.5 p-1 backdrop-blur-xs">
                        <button
                          onClick={() => setEditingSlotKey(slot.key)}
                          className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Eraser size={11} />
                          <span>누끼 수정</span>
                        </button>
                        <button
                          onClick={() => {
                            setViewSlots((prev) =>
                              prev.map((s) =>
                                s.key === slot.key
                                  ? { ...s, file: null, originalPreview: null, processedPreview: null, base64: null, status: "idle" }
                                  : s
                              )
                            );
                          }}
                          className="px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] cursor-pointer"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor={`file-upload-${slot.key}`}
                      className="w-full aspect-square rounded-lg border border-dashed border-white/20 hover:border-indigo-400/50 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-indigo-950/20 transition-all"
                    >
                      <ImagePlus size={18} className="text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-medium">사진 선택</span>
                      <input
                        id={`file-upload-${slot.key}`}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) processSlotFile(slot.key, f);
                        }}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit Multi-View Analysis Button */}
          {(() => {
            const readyCount = viewSlots.filter((s) => s.status === "ready" && s.base64).length;
            const frontSlot = viewSlots.find((s) => s.key === "front");
            const frontSlotReady = Boolean(frontSlot && frontSlot.status === "ready" && frontSlot.base64);

            return (
              <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                <button
                  onClick={handleStartMultiViewAnalysis}
                  disabled={!frontSlotReady}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    frontSlotReady
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25"
                      : "bg-slate-800/80 text-slate-500 cursor-not-allowed border border-white/5"
                  }`}
                >
                  <Sparkles size={14} className={frontSlotReady ? "text-amber-300" : "text-slate-500"} />
                  <span>
                    {frontSlotReady
                      ? `✨ 선택한 ${readyCount}개 각도 사진으로 3D 분석 시작하기`
                      : "📷 필수 정면(Front) 사진을 먼저 올려주세요"}
                  </span>
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
