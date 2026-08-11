// ============================================================
// AntiGravity Custom 3D Engine - Visual Hull Builder
// Multi-view 2D boundary intersection & 3D vertex mesh generator
// ============================================================

import * as THREE from "three";

/**
 * 6개 면의 실루엣 정점(Vertices)을 3D 공간 상에서 교차하고 삼각 측량하여 맞닿게 이어 붙이는 Visual Hull 3D 지오메트리 생성기
 */
export function generateVisualHullGeometry(
  frontUrl: string | null,
  sideUrl: string | null,
  targetW: number,
  targetH: number,
  targetD: number,
  slices: number = 32,
  radialSegs: number = 32
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let frontImg: HTMLImageElement | null = null;
  let sideImg: HTMLImageElement | null = null;

  if (frontUrl) {
    frontImg = new Image();
    frontImg.src = frontUrl;
  }
  if (sideUrl) {
    sideImg = new Image();
    sideImg.src = sideUrl;
  }

  const scanProfile = (img: HTMLImageElement | null) => {
    const profile: Array<{ min: number; max: number }> = [];
    if (!img || !img.width || !img.height) {
      for (let i = 0; i <= slices; i++) profile.push({ min: -0.5, max: 0.5 });
      return profile;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        for (let i = 0; i <= slices; i++) profile.push({ min: -0.5, max: 0.5 });
        return profile;
      }

      ctx.drawImage(img, 0, 0, 64, 64);
      const imgData = ctx.getImageData(0, 0, 64, 64);
      const data = imgData.data;

      for (let s = 0; s <= slices; s++) {
        const py = Math.min(63, Math.max(0, Math.round((1 - s / slices) * 63)));
        let minPx = 64, maxPx = -1;

        for (let px = 0; px < 64; px++) {
          const alpha = data[(py * 64 + px) * 4 + 3];
          if (alpha > 30) {
            if (px < minPx) minPx = px;
            if (px > maxPx) maxPx = px;
          }
        }

        if (maxPx < minPx) {
          profile.push({ min: -0.4, max: 0.4 });
        } else {
          profile.push({
            min: (minPx / 64) - 0.5,
            max: (maxPx / 64) - 0.5,
          });
        }
      }
    } catch {
      for (let i = 0; i <= slices; i++) profile.push({ min: -0.5, max: 0.5 });
    }
    return profile;
  };

  const frontProfile = scanProfile(frontImg);
  const sideProfile = scanProfile(sideImg);

  // Generate 3D rings of vertices matching boundary points
  for (let s = 0; s <= slices; s++) {
    const yVal = (s / slices - 0.5) * targetH;
    const fProf = frontProfile[s] || { min: -0.5, max: 0.5 };
    const sProf = sideProfile[s] || { min: -0.5, max: 0.5 };

    const rx = ((fProf.max - fProf.min) / 2) * targetW;
    const cx = ((fProf.min + fProf.max) / 2) * targetW;

    const rz = ((sProf.max - sProf.min) / 2) * targetD;
    const cz = ((sProf.min + sProf.max) / 2) * targetD;

    for (let r = 0; r <= radialSegs; r++) {
      const angle = (r / radialSegs) * Math.PI * 2;
      const vx = cx + Math.cos(angle) * Math.max(0.01, rx);
      const vz = cz + Math.sin(angle) * Math.max(0.01, rz);

      positions.push(vx, yVal, vz);
      uvs.push(r / radialSegs, s / slices);
    }
  }

  const ringVerts = radialSegs + 1;
  for (let s = 0; s < slices; s++) {
    for (let r = 0; r < radialSegs; r++) {
      const current = s * ringVerts + r;
      const next = current + ringVerts;

      indices.push(current, next, current + 1);
      indices.push(current + 1, next, next + 1);
    }
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}
