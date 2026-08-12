import * as THREE from 'three';
import { GeometryData, ModelProperties } from '../store/editorStore';

export interface Smart3DResult {
  geometry: GeometryData;
  properties?: Partial<ModelProperties>;
  description: string;
}

export function bufferGeometryToData(geom: THREE.BufferGeometry): GeometryData {
  geom.computeVertexNormals();
  const posAttr = geom.getAttribute('position');
  const normalAttr = geom.getAttribute('normal');
  const indexAttr = geom.getIndex();

  const vertices: number[] = Array.from(posAttr.array);
  const normals: number[] = normalAttr ? Array.from(normalAttr.array) : [];
  const indices: number[] = indexAttr ? Array.from(indexAttr.array) : [];

  return {
    vertices,
    indices,
    normals,
  };
}

export function generate3DFromPrompt(prompt: string): Smart3DResult {
  const p = prompt.toLowerCase();
  let geom: THREE.BufferGeometry;
  const props: Partial<ModelProperties> = { color: '#3b82f6', roughness: 0.4, metalness: 0.3 };
  let desc = 'Generated custom 3D model.';

  // Color parsing
  if (p.includes('빨간') || p.includes('레드') || p.includes('red')) props.color = '#ef4444';
  else if (p.includes('파란') || p.includes('블루') || p.includes('blue')) props.color = '#3b82f6';
  else if (p.includes('초록') || p.includes('그린') || p.includes('green')) props.color = '#22c55e';
  else if (p.includes('노란') || p.includes('골드') || p.includes('yellow') || p.includes('gold')) {
    props.color = '#eab308'; props.metalness = 0.8; props.roughness = 0.2;
  } else if (p.includes('보라') || p.includes('purple')) props.color = '#a855f7';
  else if (p.includes('검은') || p.includes('블랙') || p.includes('black')) props.color = '#1e293b';
  else if (p.includes('은색') || p.includes('silver') || p.includes('금속') || p.includes('metal')) {
    props.color = '#94a3b8'; props.metalness = 0.9; props.roughness = 0.1;
  }

  // Geometry parsing
  if (p.includes('구') || p.includes('공') || p.includes('sphere') || p.includes('ball')) {
    geom = new THREE.SphereGeometry(1, 32, 32);
    desc = 'Smooth Sphere 3D geometry created.';
  } else if (p.includes('원기둥') || p.includes('실린더') || p.includes('cylinder') || p.includes('기둥')) {
    geom = new THREE.CylinderGeometry(0.8, 0.8, 2, 32);
    desc = 'Cylinder 3D geometry created.';
  } else if (p.includes('원뿔') || p.includes('cone') || p.includes('pyramid')) {
    geom = new THREE.ConeGeometry(1, 2, 32);
    desc = 'Cone 3D geometry created.';
  } else if (p.includes('도넛') || p.includes('고리') || p.includes('torus') || p.includes('donut')) {
    geom = new THREE.TorusGeometry(1, 0.35, 16, 48);
    desc = 'Torus / Donut 3D geometry created.';
  } else if (p.includes('의자') || p.includes('chair')) {
    // Procedural Chair
    const seat = new THREE.BoxGeometry(1.2, 0.1, 1.2);
    seat.translate(0, 0.5, 0);

    const back = new THREE.BoxGeometry(1.2, 1.2, 0.1);
    back.translate(0, 1.1, -0.55);

    const leg1 = new THREE.CylinderGeometry(0.05, 0.05, 1); leg1.translate(-0.5, 0, -0.5);
    const leg2 = new THREE.CylinderGeometry(0.05, 0.05, 1); leg2.translate(0.5, 0, -0.5);
    const leg3 = new THREE.CylinderGeometry(0.05, 0.05, 1); leg3.translate(-0.5, 0, 0.5);
    const leg4 = new THREE.CylinderGeometry(0.05, 0.05, 1); leg4.translate(0.5, 0, 0.5);

    // Merge geometries
    const parts = [seat, back, leg1, leg2, leg3, leg4];
    geom = mergeBufferGeometries(parts);
    desc = 'Procedural Chair 3D model created.';
  } else if (p.includes('책상') || p.includes('테이블') || p.includes('table') || p.includes('desk')) {
    const top = new THREE.BoxGeometry(2.4, 0.1, 1.4); top.translate(0, 1, 0);
    const l1 = new THREE.CylinderGeometry(0.06, 0.06, 1); l1.translate(-1.0, 0.5, -0.5);
    const l2 = new THREE.CylinderGeometry(0.06, 0.06, 1); l2.translate(1.0, 0.5, -0.5);
    const l3 = new THREE.CylinderGeometry(0.06, 0.06, 1); l3.translate(-1.0, 0.5, 0.5);
    const l4 = new THREE.CylinderGeometry(0.06, 0.06, 1); l4.translate(1.0, 0.5, 0.5);

    geom = mergeBufferGeometries([top, l1, l2, l3, l4]);
    desc = 'Procedural Table 3D model created.';
  } else if (p.includes('체스') || p.includes('chess') || p.includes('폰') || p.includes('pawn')) {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      points.push(new THREE.Vector2(Math.sin(i * 0.2) * 0.5 + 0.2, (i - 5) * 0.2));
    }
    geom = new THREE.LatheGeometry(points, 32);
    desc = 'Procedural Chess Piece 3D geometry created.';
  } else {
    // Default cube / box
    geom = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    desc = 'Standard Box 3D geometry created.';
  }

  return {
    geometry: bufferGeometryToData(geom),
    properties: props,
    description: desc,
  };
}

function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  let vertexOffset = 0;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (const g of geometries) {
    g.computeVertexNormals();
    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    const idx = g.getIndex();

    for (let i = 0; i < pos.count * 3; i++) {
      positions.push(pos.array[i]);
      if (norm) normals.push(norm.array[i]);
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.array[i] + vertexOffset);
      }
    }
    vertexOffset += pos.count;
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length > 0) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (indices.length > 0) merged.setIndex(indices);

  return merged;
}
