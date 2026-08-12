'use client';

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useEditorStore, SceneObject } from '@/lib/store/editorStore';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';

function SingleMesh({ obj }: { obj: SceneObject }) {
  const { selectedObjectId, selectObject, transformMode } = useEditorStore();
  const isSelected = selectedObjectId === obj.id;
  const meshRef = useRef<THREE.Mesh>(null);
  const [target, setTarget] = useState<THREE.Mesh | null>(null);

  useEffect(() => {
    if (meshRef.current) {
      setTarget(meshRef.current);
    }
  }, [obj.id]);

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const data = obj.geometryData;

    if (data.vertices && data.vertices.length > 0) {
      geom.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices, 3));
    }
    if (data.indices && data.indices.length > 0) {
      geom.setIndex(data.indices);
    }
    if (data.colors && data.colors.length > 0) {
      geom.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    }
    if (data.normals && data.normals.length > 0) {
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    } else {
      geom.computeVertexNormals();
    }
    if (data.uvs && data.uvs.length > 0) {
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
    }

    return geom;
  }, [obj.geometryData]);

  return (
    <>
      <mesh
        ref={meshRef}
        position={obj.position}
        rotation={obj.rotation}
        scale={obj.scale}
        geometry={geometry}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          selectObject(obj.id);
        }}
      >
        <meshStandardMaterial
          color={obj.properties.color}
          roughness={obj.properties.roughness}
          metalness={obj.properties.metalness}
          vertexColors={!!obj.geometryData.colors}
          side={THREE.DoubleSide}
        />
      </mesh>

      {isSelected && target && (
        <TransformControls
          object={target}
          mode={transformMode}
          size={0.6}
          showX
          showY
          showZ
          onMouseUp={() => {
            const { position, rotation, scale } = target;
            useEditorStore.getState().updateObjectTransform(obj.id, {
              position: [position.x, position.y, position.z],
              rotation: [rotation.x, rotation.y, rotation.z],
              scale: [scale.x, scale.y, scale.z],
            });
          }}
        />
      )}
    </>
  );
}

export default function ModelViewer() {
  const { objects, selectedObjectId, removeObject } = useEditorStore();

  // Keyboard shortcut for deleting selected object
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        removeObject(selectedObjectId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, removeObject]);

  return (
    <group>
      {objects.map((obj) => (
        <SingleMesh key={obj.id} obj={obj} />
      ))}
    </group>
  );
}
