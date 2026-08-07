/**
 * Background Removal Utility
 * 1. AI-based background removal (@imgly/background-removal)
 * 2. Canvas auto-matting fallback (Color difference matting with edge feathering)
 */

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

      // Sample border pixels (corners and edge centers) to determine background color
      const corners = [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
        [Math.floor(width / 2), 0],
        [Math.floor(width / 2), height - 1],
        [0, Math.floor(height / 2)],
        [width - 1, Math.floor(height / 2)],
      ];

      let bgR = 0, bgG = 0, bgB = 0;
      for (const [x, y] of corners) {
        const idx = (y * width + x) * 4;
        bgR += data[idx];
        bgG += data[idx + 1];
        bgB += data[idx + 2];
      }
      bgR = Math.round(bgR / corners.length);
      bgG = Math.round(bgG / corners.length);
      bgB = Math.round(bgB / corners.length);

      // Color distance thresholds
      const hardThreshold = 35;
      const softThreshold = 65;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Euclidean distance in RGB color space
        const dist = Math.sqrt(
          (r - bgR) * (r - bgR) +
          (g - bgG) * (g - bgG) +
          (b - bgB) * (b - bgB)
        );

        if (dist < hardThreshold) {
          data[i + 3] = 0; // Make background pixel completely transparent
        } else if (dist < softThreshold) {
          // Feathering for smooth edge anti-aliasing
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

  // 2. Try @imgly/background-removal (client AI model) with 3.5 second timeout
  try {
    const removeBackground = (await import("@imgly/background-removal")).default;
    const blob = await Promise.race([
      removeBackground(file),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Imgly timeout")), 3500)
      ),
    ]);
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
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
