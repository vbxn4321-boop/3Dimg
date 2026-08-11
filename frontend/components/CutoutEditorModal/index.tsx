"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Eraser, Paintbrush, Undo2, RotateCcw, Check, ZoomIn, ZoomOut, Eye, Sparkles } from "lucide-react";

interface CutoutEditorModalProps {
  isOpen: boolean;
  originalImageUrl: string;
  currentCutoutUrl: string;
  onClose: () => void;
  onSave: (editedBase64: string, previewUrl: string) => void;
}

export default function CutoutEditorModal({
  isOpen,
  originalImageUrl,
  currentCutoutUrl,
  onClose,
  onSave,
}: CutoutEditorModalProps) {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const origCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [tool, setTool] = useState<"erase" | "restore" | "wand">("erase");
  const [brushSize, setBrushSize] = useState<number>(20);
  const [bgMode, setBgMode] = useState<"checkered" | "dark" | "light" | "red">("checkered");
  const [history, setHistory] = useState<ImageData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Magic Wand Flood Fill Erase: 1-click erase connected matching background pixels
  const magicWandErase = (startX: number, startY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const pxX = Math.floor(startX);
    const pxY = Math.floor(startY);
    if (pxX < 0 || pxX >= w || pxY < 0 || pxY >= h) return;

    const startIdx = (pxY * w + pxX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const targetA = data[startIdx + 3];

    if (targetA === 0) return; // Already transparent

    const tolerance = 32;
    const visited = new Uint8Array(w * h);
    const queue = [pxY * w + pxX];

    while (queue.length > 0) {
      const idx = queue.pop()!;
      if (visited[idx]) continue;
      visited[idx] = 1;

      const pIdx = idx * 4;
      const r = data[pIdx];
      const g = data[pIdx + 1];
      const b = data[pIdx + 2];

      const diff = Math.sqrt(
        (r - targetR) * (r - targetR) * 0.299 +
        (g - targetG) * (g - targetG) * 0.587 +
        (b - targetB) * (b - targetB) * 0.114
      );

      if (diff <= tolerance && data[pIdx + 3] > 0) {
        data[pIdx + 3] = 0; // Erase pixel

        const cx = idx % w;
        const cy = Math.floor(idx / w);

        if (cx > 0) queue.push(idx - 1);
        if (cx < w - 1) queue.push(idx + 1);
        if (cy > 0) queue.push(idx - w);
        if (cy < h - 1) queue.push(idx + w);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    saveHistoryState();
  };

  // Auto Smooth Edges & Noise Cleanup
  const handleAutoSmooth = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Smooth edge alpha
    const alphaCopy = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      alphaCopy[i] = data[i * 4 + 3];
    }

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const a = alphaCopy[idx];

        if (a > 0 && a < 255) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += alphaCopy[(y + dy) * w + (x + dx)];
            }
          }
          data[idx * 4 + 3] = Math.round(sum / 9);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    saveHistoryState();
  };

  // Initialize Canvas with Original and Current Cutout images
  useEffect(() => {
    if (!isOpen || (!originalImageUrl && !currentCutoutUrl)) return;

    setIsLoaded(false);
    setHistory([]);

    const origSrc = originalImageUrl || currentCutoutUrl;
    const cutoutSrc = currentCutoutUrl || originalImageUrl;

    const origImg = new Image();
    const cutoutImg = new Image();

    // Only set crossOrigin for external http/https URLs, NEVER for data: or blob: URLs
    if (origSrc.startsWith("http")) origImg.crossOrigin = "anonymous";
    if (cutoutSrc.startsWith("http")) cutoutImg.crossOrigin = "anonymous";

    let loadedCount = 0;
    const handleReady = () => {
      loadedCount++;
      if (loadedCount < 2) return;

      const canvas = canvasRef.current;
      const origCanvas = origCanvasRef.current;
      if (!canvas || !origCanvas) return;

      const ctx = canvas.getContext("2d");
      const origCtx = origCanvas.getContext("2d");
      if (!ctx || !origCtx) return;

      const w = origImg.naturalWidth || cutoutImg.naturalWidth || 800;
      const h = origImg.naturalHeight || cutoutImg.naturalHeight || 800;

      canvas.width = w;
      canvas.height = h;
      origCanvas.width = w;
      origCanvas.height = h;

      // Draw original image on offscreen origCanvas
      origCtx.clearRect(0, 0, w, h);
      origCtx.drawImage(origImg.complete && origImg.naturalWidth ? origImg : cutoutImg, 0, 0, w, h);

      // Draw current cutout on main interactive canvas
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(cutoutImg.complete && cutoutImg.naturalWidth ? cutoutImg : origImg, 0, 0, w, h);

      // Save initial state to history
      try {
        const initialData = ctx.getImageData(0, 0, w, h);
        setHistory([initialData]);
      } catch {
        // Fallback
      }
      setIsLoaded(true);
    };

    origImg.onload = handleReady;
    origImg.onerror = handleReady;

    cutoutImg.onload = handleReady;
    cutoutImg.onerror = handleReady;

    origImg.src = origSrc;
    cutoutImg.src = cutoutSrc;
  }, [isOpen, originalImageUrl, currentCutoutUrl]);

  // Helper to save current canvas state to history undo stack
  const saveHistoryState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-15), state]); // Keep last 15 states
  };

  // Undo last brush action
  const handleUndo = () => {
    if (history.length <= 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newHistory = history.slice(0, -1);
    const prevState = newHistory[newHistory.length - 1];
    ctx.putImageData(prevState, 0, 0);
    setHistory(newHistory);
  };

  // Reset to initial cutout image
  const handleReset = () => {
    if (history.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const initialState = history[0];
    ctx.putImageData(initialState, 0, 0);
    setHistory([initialState]);
  };

  // Canvas Mouse / Touch Painting Handlers
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const drawBrushStroke = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const origCanvas = origCanvasRef.current;
    if (!canvas || !origCanvas) return;

    const ctx = canvas.getContext("2d");
    const origCtx = origCanvas.getContext("2d");
    if (!ctx || !origCtx) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);

    if (tool === "erase") {
      // Erase mode: destination-out makes painted area transparent
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fill();
    } else {
      // Restore mode: copy pixels from original canvas back to cutout canvas
      ctx.clip();
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(origCanvas, 0, 0);
    }

    ctx.restore();
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setCursorPos(coords);

    if (tool === "wand") {
      magicWandErase(coords.x, coords.y);
      return;
    }

    setIsDrawing(true);
    drawBrushStroke(coords.x, coords.y);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setCursorPos(coords);
    if (isDrawing && tool !== "wand") {
      drawBrushStroke(coords.x, coords.y);
    }
  };

  const handlePointerUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistoryState();
    }
  };

  // Save edited cutout
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    onSave(base64, dataUrl);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const modalNode = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fade-in">
      {/* Offscreen Canvas for original image */}
      <canvas ref={origCanvasRef} className="hidden" />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-indigo-500/30 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Eraser size={18} className="text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">누끼 정밀 편집기</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
              지우개 / 복원 / 마술봉 / 경계 스무딩
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-slate-900 border-b border-white/10 text-xs">
          {/* Tool Selection */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-white/10">
            <button
              onClick={() => setTool("erase")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                tool === "erase"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Eraser size={13} />
              <span>🧹 지우개</span>
            </button>

            <button
              onClick={() => setTool("wand")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                tool === "wand"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
              title="원클릭으로 연결된 같은 배경 색상을 한 번에 지웁니다"
            >
              <Sparkles size={13} className="text-amber-300" />
              <span>🪄 마술봉</span>
            </button>

            <button
              onClick={() => setTool("restore")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                tool === "restore"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Paintbrush size={13} />
              <span>🖌️ 피사체 복원</span>
            </button>
          </div>

          {/* Auto Smooth Edges Button */}
          <button
            onClick={handleAutoSmooth}
            className="px-3 py-1.5 rounded-xl font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
            title="거친 경계 테두리를 부드럽게 감싸고 잔여 배경 노이즈를 다듬습니다"
          >
            <Sparkles size={13} className="text-amber-400" />
            <span>✨ 자동 경계 다듬기</span>
          </button>

          {/* Brush Size Slider */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-white/10">
            <span className="text-slate-400 text-[11px] font-medium">크기</span>
            <input
              type="range"
              min="4"
              max="70"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-indigo-400 font-mono text-[11px] w-6">{brushSize}px</span>
          </div>

          {/* Background Contrast Options */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10">
            <span className="text-slate-500 text-[10px] px-1 font-medium flex items-center gap-1">
              <Eye size={11} /> 배경색
            </span>
            {[
              { id: "checkered", label: "🏁 체크판" },
              { id: "dark", label: "🖤 어두움" },
              { id: "light", label: "🤍 밝음" },
              { id: "red", label: "🔴 빨강 대비" },
            ].map((b) => (
              <button
                key={b.id}
                onClick={() => setBgMode(b.id as any)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  bgMode === b.id
                    ? "bg-indigo-600/40 text-indigo-300 border border-indigo-500/50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* History Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
              title="실행 취소 (Undo)"
            >
              <Undo2 size={14} />
            </button>

            <button
              onClick={handleReset}
              disabled={history.length <= 1}
              className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
              title="초기화"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Canvas Editing Workspace */}
        <div
          className="relative flex-1 min-h-[380px] flex items-center justify-center p-4 overflow-hidden select-none"
          style={{
            backgroundImage:
              bgMode === "checkered"
                ? "repeating-conic-gradient(rgba(255,255,255,0.08) 0% 25%, transparent 0% 50%)"
                : "none",
            backgroundSize: "20px 20px",
            backgroundColor:
              bgMode === "dark"
                ? "#090d16"
                : bgMode === "light"
                ? "#e2e8f0"
                : bgMode === "red"
                ? "#7f1d1d"
                : "#0d111c",
          }}
        >
          {!isLoaded && (
            <div className="text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>캔버스 준비 중...</span>
            </div>
          )}

          <canvas
            ref={canvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            className="max-w-full max-h-[60vh] object-contain cursor-crosshair rounded shadow-2xl border border-white/10"
          />

          {/* Floating Instructions Banner */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-md text-[11px] text-slate-300 pointer-events-none flex items-center gap-2">
            <span>
              {tool === "erase" ? "🧹 마우스로 잔여 배경을 드래그해서 지우세요" : "🖌️ 마우스로 실수로 지워진 피사체를 칠해서 복원하세요"}
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium border border-white/10 hover:bg-white/5 text-slate-300 transition-all cursor-pointer"
          >
            취소
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Check size={14} />
            <span>편집 완료 & 3D 반영</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
