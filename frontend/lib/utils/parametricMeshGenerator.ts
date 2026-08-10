// ============================================================
// Parametric 3D Mesh Generator Utility
// Generates sharp, CAD-quality 3D geometry from Vision AI Parametric Bounds
// AntiGravity Multi-Agent Pipeline
// ============================================================

import * as THREE from "three";
import type { ParametricBounds } from "@/lib/types/agentSchema";

export interface ParametricMeshInput {
  bounds?: ParametricBounds;
  frontImageBase64?: string;
  multiViewImages?: Array<{ view: string; base64: string; mimeType: string }>;
}

export function createParametricGeometry(bounds?: ParametricBounds): THREE.BufferGeometry {
  const shapeType = bounds?.shapeType || "box";
  const w = Math.max(0.2, bounds?.aspectWidth ?? 1.0);
  const h = Math.max(0.2, bounds?.aspectHeight ?? 1.5);
  const d = Math.max(0.1, bounds?.aspectDepth ?? 0.4);
  const bevel = bounds?.bevelRadius ?? 0.05;

  if (shapeType === "sphere") {
    return new THREE.SphereGeometry(w / 2, 48, 48);
  }

  if (shapeType === "cylinder") {
    return new THREE.CylinderGeometry(w / 2, w / 2, h, 48);
  }

  if (shapeType === "extruded_polygon" && bounds?.polygonPoints && bounds.polygonPoints.length >= 3) {
    const shape = new THREE.Shape();
    const pts = bounds.polygonPoints;

    shape.moveTo(pts[0][0] * (w / 2), pts[0][1] * (h / 2));
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i][0] * (w / 2), pts[i][1] * (h / 2));
    }
    shape.closePath();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: d,
      bevelEnabled: bevel > 0,
      bevelSegments: 4,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.center();
    return geom;
  }

  // Default: Rounded Prism / Box with clean bevels
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;

  // Rounded rectangle 2D shape
  const r = Math.min(bevel, hw, hh);
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: d,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: r * 0.5,
    bevelThickness: r * 0.5,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.center();
  return geom;
}

export function createParametricMaterials(input: ParametricMeshInput): THREE.Material | THREE.Material[] {
  // Metallic matte material default
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#475569"),
    roughness: 0.35,
    metalness: 0.65,
    side: THREE.DoubleSide,
  });

  return baseMaterial;
}
