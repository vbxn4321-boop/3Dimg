// ============================================================
// AntiGravity Custom 3D Engine - Contour Extruder
// Alpha contour path extraction & ExtrudeGeometry 3D sculpting
// ============================================================

import * as THREE from "three";

/** 이미지 알파 채널에서 2D 실루엣 윤곽선 Shape 생성 함수 */
export function extractContourShape(
  dataUrl: string | null,
  targetWidth: number,
  targetHeight: number,
  samples: number = 64
): THREE.Shape | null {
  if (!dataUrl) return null;

  try {
    const img = new Image();
    img.src = dataUrl;
    if (!img.width || !img.height) return null;

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, 128, 128);
    const imgData = ctx.getImageData(0, 0, 128, 128);
    const data = imgData.data;

    const points: Array<{ x: number; y: number }> = [];
    const centerX = 64;
    const centerY = 64;

    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      let foundR = 0;
      for (let r = 0; r < 64; r++) {
        const px = Math.round(centerX + cos * r);
        const py = Math.round(centerY + sin * r);

        if (px < 0 || px >= 128 || py < 0 || py >= 128) break;
        const alpha = data[(py * 128 + px) * 4 + 3];
        if (alpha > 30) {
          foundR = r;
        }
      }

      if (foundR < 5) foundR = 45;

      const normX = (cos * foundR) / 64;
      const normY = -(sin * foundR) / 64; // Invert Y for Three.js
      points.push({
        x: normX * (targetWidth / 2),
        y: normY * (targetHeight / 2),
      });
    }

    if (points.length < 3) return null;

    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      shape.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    shape.closePath();
    return shape;
  } catch (err) {
    console.warn("Contour shape extraction failed:", err);
    return null;
  }
}
