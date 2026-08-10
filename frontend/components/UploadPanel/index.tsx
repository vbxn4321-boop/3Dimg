"use client";

import { useCallback, useState } from "react";
import { Upload, ImagePlus, X, CheckCircle, Loader2, Scissors } from "lucide-react";

import { processImageBackground } from "@/lib/utils/removeBackground";

interface UploadPanelProps {
  onImageReady: (imageBase64: string, mimeType: string, backgroundRemoved: boolean, previewUrl: string) => void;
  isProcessing?: boolean;
}

export default function UploadPanel({ onImageReady, isProcessing }: UploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "removing_bg" | "ready">("idle");
  const [fileName, setFileName] = useState<string>("");

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    setFileName(file.name);
    setStatus("uploading");

    // Show original preview
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
      // Fallback: use original image via FileReader (safe for large files)
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleReset = () => {
    setOriginalPreview(null);
    setProcessedPreview(null);
    setStatus("idle");
    setFileName("");
  };

  if (status === "ready" && processedPreview) {
    return (
      <div className="flex flex-col gap-3 animate-fade-in">
        {/* Before / After */}
        <div className="grid grid-cols-2 gap-2">
          {originalPreview && (
            <div className="relative">
              <p className="text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>원본</p>
              <div
                className="rounded-lg overflow-hidden aspect-square"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <img src={originalPreview} alt="원본" className="w-full h-full object-contain" />
              </div>
            </div>
          )}
          <div className="relative">
            <div className="flex items-center gap-1 mb-1.5">
              <Scissors size={11} style={{ color: "var(--color-success)" }} />
              <p className="text-xs" style={{ color: "var(--color-success)" }}>배경 제거</p>
            </div>
            <div
              className="rounded-lg overflow-hidden aspect-square"
              style={{
                backgroundImage: "repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%)",
                backgroundSize: "16px 16px",
              }}
            >
              <img src={processedPreview} alt="배경제거" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>

        {/* File info */}
        <div className="flex flex-col gap-2">
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle size={14} style={{ color: "var(--color-success)" }} className="flex-shrink-0" />
              <span className="text-xs font-medium truncate" style={{ color: "var(--color-success)" }}>
                {fileName}
              </span>
            </div>
            <button
              onClick={handleReset}
              className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
              style={{ color: "var(--color-text-muted)" }}
              title="초기화"
            >
              <X size={14} />
            </button>
          </div>

          <button
            onClick={handleReset}
            className="w-full py-2 px-3 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-1.5 text-slate-300 cursor-pointer"
          >
            <ImagePlus size={13} />
            다른 이미지 업로드 / 변경하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {status === "removing_bg" ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl py-10"
          style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-accent-primary)" }} />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              배경 제거 중...
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              AI가 이미지를 분석하고 있어요
            </p>
          </div>
        </div>
      ) : (
        <label
          className={`upload-zone flex flex-col items-center justify-center gap-4 py-10 px-4 cursor-pointer ${isDragging ? "drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          htmlFor="file-upload"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center animate-float"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))",
              border: "1px solid rgba(99,102,241,0.3)",
            }}
          >
            <ImagePlus size={24} style={{ color: "var(--color-accent-primary)" }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              이미지를 드래그하거나 클릭하세요
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              PNG, JPG, WebP 지원 · 최대 10MB
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {["제품 사진", "캐릭터", "건축물", "소품"].map((tag) => (
              <span key={tag} className="tag-chip">{tag}</span>
            ))}
          </div>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileInput}
          />
        </label>
      )}

      {/* Single clean sample image preset */}
      <div className="flex justify-center pt-2 border-t border-white/5">
        <button
          onClick={async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#1e293b";
              ctx.fillRect(0, 0, 200, 200);
              ctx.fillStyle = "#6366f1";
              ctx.beginPath();
              ctx.arc(100, 90, 45, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#ffffff";
              ctx.font = "bold 14px sans-serif";
              ctx.textAlign = "center";
              ctx.fillText("샘플 스포티 러닝화", 100, 160);
            }
            const dataUrl = canvas.toDataURL("image/png");
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], "sample-sneaker.png", { type: "image/png" });
            processFile(file);
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-indigo-600/20 hover:text-indigo-300 border border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>✨ 샘플 이미지로 바로 시작</span>
        </button>
      </div>
    </div>
  );
}
