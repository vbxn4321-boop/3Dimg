/**
 * Background Removal Utility
 * 1. AI-based background removal (@imgly/background-removal)
 * 2. Canvas auto-matting fallback (Color difference matting with edge feathering)
 */

/** Safely convert a Blob to a base64 string using FileReader (no stack-overflow risk for large files). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl is "data:<mime>;base64,<b64>" — strip the prefix
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Resize an image File to ≤maxSide px on the longest edge.
 * Returns a new File with the same name/type so it can be passed to imgly.
 * Keeps original if already small enough.
 */
async function resizeFileForImgly(file: File, maxSide = 1024): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= maxSide && h <= maxSide) {
        resolve(file); // Already small enough
        return;
      }
      const scale = maxSide / Math.max(w, h);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name, { type: file.type }));
      }, file.type || "image/png", 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export interface RemoveBgResult {
  imageBase64: string;
  mimeType: string;
  backgroundRemoved: boolean;
}

export async function removeBackgroundCanvas(dataUrl: string): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ base64: dataUrl.split(",")[1] || dataUrl, mimeType: "image/png" });
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const width = canvas.width;
      const height = canvas.height;

      // ---- Step 1: Sample full border band (5% of shorter side wide) ----
      // This gives a much more robust background color estimate than 8 corners.
      const bandW = Math.max(2, Math.round(Math.min(width, height) * 0.05));
      const rSamples: number[] = [];
      const gSamples: number[] = [];
      const bSamples: number[] = [];

      const samplePixel = (x: number, y: number) => {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] < 10) return; // Skip near-transparent pixels
        rSamples.push(data[idx]);
        gSamples.push(data[idx + 1]);
        bSamples.push(data[idx + 2]);
      };

      // Top and bottom bands
      for (let by = 0; by < bandW; by++) {
        for (let x = 0; x < width; x++) {
          samplePixel(x, by);
          samplePixel(x, height - 1 - by);
        }
      }
      // Left and right bands (exclude corners already covered)
      for (let bx = 0; bx < bandW; bx++) {
        for (let y = bandW; y < height - bandW; y++) {
          samplePixel(bx, y);
          samplePixel(width - 1 - bx, y);
        }
      }

      // Use median rather than mean — median is more robust to foreground spill
      const median = (arr: number[]) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };

      const bgR = median(rSamples);
      const bgG = median(gSamples);
      const bgB = median(bSamples);

      // ---- Step 2: Adaptive thresholds based on background brightness ----
      // Bright/pastel backgrounds need tighter thresholds to avoid over-removal
      const bgLuma = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
      const hardThreshold = bgLuma > 200 ? 28 : bgLuma < 50 ? 22 : 35;
      const softThreshold = hardThreshold + 35;

      // ---- Step 3: Perceptual weighted colour distance ----
      // Weights match human eye sensitivity: green > red > blue
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; // Already transparent

        const dr = data[i]     - bgR;
        const dg = data[i + 1] - bgG;
        const db = data[i + 2] - bgB;

        // Weighted Euclidean distance in perceptual RGB
        const dist = Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);

        if (dist < hardThreshold) {
          data[i + 3] = 0; // Fully transparent
        } else if (dist < softThreshold) {
          // Smooth feathering on edges
          const alpha = ((dist - hardThreshold) / (softThreshold - hardThreshold)) * 255;
          data[i + 3] = Math.min(data[i + 3], Math.round(alpha));
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const pngDataUrl = canvas.toDataURL("image/png");
      const base64 = pngDataUrl.split(",")[1];
      resolve({ base64, mimeType: "image/png" });
    };

    img.onerror = () => {
      resolve({ base64: dataUrl.split(",")[1] || dataUrl, mimeType: "image/png" });
    };

    img.src = dataUrl;
  });
}


export async function processImageBackground(file: File): Promise<RemoveBgResult> {
  // 1. Try server route first (if remove.bg API key is provided)
  try {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/rembg", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success && data.backgroundRemoved) {
      return {
        imageBase64: data.imageBase64,
        mimeType: data.mimeType,
        backgroundRemoved: true,
      };
    }
  } catch (err) {
    console.warn("[RemBg Route] Failed, proceeding to client-side removal:", err);
  }

  // 2. Try @imgly/background-removal (client AI model) with 30 second timeout
  try {
    const { removeBackground: imglyRemoveBackground } = await import("@imgly/background-removal");
    // Resize to ≤1024px first: prevents stack-overflow on large images and
    // dramatically speeds up single-threaded ONNX inference
    const resizedFile = await resizeFileForImgly(file, 1024);
    const blob = await Promise.race([
      imglyRemoveBackground(resizedFile, { model: "isnet_fp16" }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Imgly timeout")), 30000)
      ),
    ]);
    const base64 = await blobToBase64(blob);
    return {
      imageBase64: base64,
      mimeType: "image/png",
      backgroundRemoved: true,
    };
  } catch (imglyErr) {
    console.warn("[Imgly AI] Timeout or error, falling back to Smart Canvas Matting:", imglyErr);
  }

  // 3. Fallback: Fast Smart Canvas Auto-Matting
  const reader = new FileReader();
  const origDataUrl = await new Promise<string>((resolve) => {
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });

  const canvasResult = await removeBackgroundCanvas(origDataUrl);
  return {
    imageBase64: canvasResult.base64,
    mimeType: canvasResult.mimeType,
    backgroundRemoved: true,
  };
}
