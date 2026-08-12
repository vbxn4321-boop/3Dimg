import { GLTFExporter, OBJExporter, STLExporter } from 'three-stdlib';
import * as THREE from 'three';
import { SceneObject } from '../store/editorStore';

function buildSceneGroup(objects: SceneObject[]): THREE.Group {
  const group = new THREE.Group();

  for (const obj of objects) {
    const geom = new THREE.BufferGeometry();
    const data = obj.geometryData;

    if (data.vertices) geom.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices, 3));
    if (data.indices) geom.setIndex(data.indices);
    if (data.colors) geom.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    if (data.normals) geom.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    else geom.computeVertexNormals();
    if (data.uvs) geom.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(obj.properties.color),
      roughness: obj.properties.roughness,
      metalness: obj.properties.metalness,
      vertexColors: !!data.colors,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(...obj.position);
    mesh.rotation.set(...obj.rotation);
    mesh.scale.set(...obj.scale);
    mesh.name = obj.name;

    group.add(mesh);
  }

  return group;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportToGLTF(objects: SceneObject[], filename = 'scene.glb') {
  if (objects.length === 0) return;
  const group = buildSceneGroup(objects);
  const exporter = new GLTFExporter();

  exporter.parse(
    group,
    (gltf) => {
      const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
      download(blob, filename);
    },
    (err) => {
      console.error('Error exporting GLTF:', err);
    },
    { binary: true }
  );
}

export function exportToOBJ(objects: SceneObject[], filename = 'scene.obj') {
  if (objects.length === 0) return;
  const group = buildSceneGroup(objects);
  const exporter = new OBJExporter();
  const result = exporter.parse(group);
  const blob = new Blob([result], { type: 'text/plain' });
  download(blob, filename);
}

export function exportToSTL(objects: SceneObject[], filename = 'scene.stl') {
  if (objects.length === 0) return;
  const group = buildSceneGroup(objects);
  const exporter = new STLExporter();
  const result = exporter.parse(group, { binary: true }) as DataView;
  const buffer = result.buffer as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  download(blob, filename);
}
