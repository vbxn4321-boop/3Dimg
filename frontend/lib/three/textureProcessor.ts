// ============================================================
// AntiGravity Custom 3D Engine - Texture Processor
// Crisp 6-Face Product Cropping & Edge-Bleed Texture Generator
// ============================================================

import * as THREE from "three";

/**
 * 6면 사진에서 투명 여백 및 손/배경을 자동 크롭하고,
 * 각 면에 1:1로 꽉 차게 피팅되는 선명한 HD 3D 텍스처를 생성합니다.
 */
export function createCroppedTexture(
  dataUrl: string,
  loader: THREE.TextureLoader,
  tightCrop?: [number, number, number, number]
): THREE.Texture {
  const tex = loader.load(dataUrl, (texture) => {
    const img = texture.image as HTMLImageElement;
    if (!img || !img.width || !img.height) return;

    try {
      // 1. 알파 채널 및 배경색 기반 정밀 Bounding Box 자동 감지 (Auto-Crop)
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imgData.data;

      let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
      let found = false;

      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const alpha = data[(y * img.width + x) * 4 + 3];
          if (alpha > 20) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            found = true;
          }
        }
      }

      // Gemini 정밀 크롭 좌표가 있으면 우선 반영
      if (tightCrop && Array.isArray(tightCrop) && tightCrop.length === 4) {
        const gMinX = Math.floor(tightCrop[0] * img.width);
        const gMinY = Math.floor(tightCrop[1] * img.height);
        const gMaxX = Math.ceil(tightCrop[2] * img.width);
        const gMaxY = Math.ceil(tightCrop[3] * img.height);
        if (gMaxX > gMinX && gMaxY > gMinY) {
          minX = gMinX;
          minY = gMinY;
          maxX = gMaxX;
          maxY = gMaxY;
          found = true;
        }
      }

      if (!found || maxX <= minX || maxY <= minY) {
        minX = 0;
        minY = 0;
        maxX = img.width;
        maxY = img.height;
      }

      const cropW = Math.max(10, maxX - minX);
      const cropH = Math.max(10, maxY - minY);

      // 2. 물체 정점에 꼭 맞춘 HD 캔버스 크롭
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cCtx = croppedCanvas.getContext("2d", { willReadFrequently: true });
      if (cCtx) {
        cCtx.imageSmoothingEnabled = true;
        cCtx.imageSmoothingQuality = "high";
        cCtx.drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

        // 3. 3D 박스 모서리가 잘리는 것을 막기 위한 외곽 색상 스마트 채우기 (Edge-Bleed)
        try {
          const cImgData = cCtx.getImageData(0, 0, cropW, cropH);
          const cData = cImgData.data;

          let sumR = 0, sumG = 0, sumB = 0, count = 0;
          for (let i = 0; i < cData.length; i += 4) {
            if (cData[i + 3] > 100) {
              sumR += cData[i];
              sumG += cData[i + 1];
              sumB += cData[i + 2];
              count++;
            }
          }

          const bgR = count > 0 ? Math.round(sumR / count) : 255;
          const bgG = count > 0 ? Math.round(sumG / count) : 255;
          const bgB = count > 0 ? Math.round(sumB / count) : 255;

          for (let i = 0; i < cData.length; i += 4) {
            if (cData[i + 3] < 120) {
              cData[i] = bgR;
              cData[i + 1] = bgG;
              cData[i + 2] = bgB;
              cData[i + 3] = 255;
            }
          }
          cCtx.putImageData(cImgData, 0, 0);
        } catch {
          // Fallback
        }

        texture.image = croppedCanvas as any;
        texture.needsUpdate = true;
      }
    } catch {
      // Fallback
    }
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  return tex;
}
