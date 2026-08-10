"use client";

import { useState } from "react";
import { ImagePlus, Loader2, Eraser, Layers, Sparkles } from "lucide-react";
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

async function compressBase64Image(
  dataUrl: string,
  maxDim: number = 800,
  quality: number = 0.8
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        const compressedUrl = canvas.toDataURL("image/webp", quality);
        const parts = compressedUrl.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        resolve({
          base64: parts[1],
          mimeType: mimeMatch ? mimeMatch[1] : "image/webp",
        });
      } else {
        const parts = dataUrl.split(",");
        resolve({ base64: parts[1], mimeType: "image/png" });
      }
    };
    img.onerror = () => {
      const parts = dataUrl.split(",");
      resolve({ base64: parts[1], mimeType: "image/png" });
    };
    img.src = dataUrl;
  });
}

export default function UploadPanel({ onImageReady, isProcessing }: UploadPanelProps) {
  const [viewSlots, setViewSlots] = useState<ViewSlotState[]>(VIEW_SLOTS_INIT);
  const [editingSlotKey, setEditingSlotKey] = useState<ViewKey | null>(null);

  // ----- Multi-View Slot File Processing -----
  const processSlotFile = async (key: ViewKey, file: File) => {
    if (!file.type.startsWith("image/")) return;

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

      // Compress slot image to avoid payload size overflow
      const compressed = await compressBase64Image(processedDataUrl, 800, 0.8);

      setViewSlots((prev) =>
        prev.map((slot) =>
          slot.key === key
            ? {
                ...slot,
                processedPreview: `data:${compressed.mimeType};base64,${compressed.base64}`,
                base64: compressed.base64,
                mimeType: compressed.mimeType,
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
      const compressed = await compressBase64Image(previewUrl, 800, 0.8);

      setViewSlots((prev) =>
        prev.map((slot) =>
          slot.key === key
            ? {
                ...slot,
                processedPreview: `data:${compressed.mimeType};base64,${compressed.base64}`,
                base64: compressed.base64,
                mimeType: compressed.mimeType,
                status: "ready" as const,
              }
            : slot
        )
      );
    }
  };

  // Trigger 3D analysis when user clicks submit button
  const handleStartMultiViewAnalysis = async () => {
    const frontSlot = viewSlots.find((s) => s.key === "front");
    if (!frontSlot || !frontSlot.base64 || !frontSlot.processedPreview) return;

    const activeSlots = viewSlots.filter((s) => s.processedPreview);
    let compositeGridBase64: string | undefined = undefined;

    if (activeSlots.length > 1) {
      try {
        const composite = await createMultiViewGridComposite(viewSlots);
        if (composite.gridBase64) {
          const compressedGrid = await compressBase64Image(composite.previewUrl, 1024, 0.75);
          compositeGridBase64 = compressedGrid.base64;
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
        mimeType: "image/webp",
      });
    }

    onImageReady(
      frontSlot.base64,
      frontSlot.mimeType || "image/png",
      true,
      frontSlot.processedPreview,
      multiViewPayload
    );
  };

  // Handle slot mode cutout edit save
  const handleSlotEditedSave = (editedBase64: string, previewUrl: string) => {
    if (!editingSlotKey) return;
    setViewSlots((prev) =>
      prev.map((slot) =>
        slot.key === editingSlotKey
          ? { ...slot, base64: editedBase64, processedPreview: previewUrl }
          : slot
      )
    );
  };

  const activeEditingSlot = viewSlots.find((s) => s.key === editingSlotKey);
  const readyCount = viewSlots.filter((s) => s.status === "ready" && s.base64).length;
  const frontSlot = viewSlots.find((s) => s.key === "front");
  const frontSlotReady = Boolean(frontSlot && frontSlot.status === "ready" && frontSlot.base64);

  return (
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

      {/* Info Banner */}
      <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs space-y-1">
        <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
          <Layers size={13} className="text-indigo-400" />
          <span>6개 각도 멀티뷰 정밀 3D 업로드</span>
        </p>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          정면 사진은 필수이며, 후면/측면 사진을 추가할수록 보이지 않는 각도까지 100% 정교하게 3D 모델로 생성됩니다.
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
    </div>
  );
}
