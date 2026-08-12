'use client';

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useEditorStore, SceneObject } from '@/lib/store/editorStore';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';

function SingleMesh({ obj }: { obj: SceneObject }) {
  const { selectedObjectId, selectedObjectIds, selectObject, toggleSelectObject, transformMode, objects } = useEditorStore();
  const isSelected = selectedObjectIds.includes(obj.id);
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [target, setTarget] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    if (obj.isGroup && groupRef.current) {
      setTarget(groupRef.current);
    } else if (meshRef.current) {
      setTarget(meshRef.current);
    }
  }, [obj.id, obj.isGroup]);

  const geometry = useMemo(() => {
    if (obj.isGroup) return null;
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
  }, [obj.geometryData, obj.isGroup]);

  const texture = useMemo(() => {
    if (!obj.properties.textureUrl || obj.isGroup) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(obj.properties.textureUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [obj.properties.textureUrl, obj.isGroup]);

  // If this is a Group Container
  if (obj.isGroup) {
    const children = objects.filter((child) => child.parentId === obj.id);
    return (
      <>
        <group
          ref={groupRef}
          position={obj.position}
          rotation={obj.rotation}
          scale={obj.scale}
          onClick={(e) => {
            e.stopPropagation();
            toggleSelectObject(obj.id, e.shiftKey || e.ctrlKey || e.metaKey);
          }}
        >
          {children.map((child) => (
            <SingleMesh key={child.id} obj={child} />
          ))}
        </group>

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

  // Standard Primitive Mesh
  return (
    <>
      <mesh
        ref={meshRef}
        position={obj.position}
        rotation={obj.rotation}
        scale={obj.scale}
        geometry={geometry || undefined}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          toggleSelectObject(obj.id, e.shiftKey || e.ctrlKey || e.metaKey);
        }}
      >
        <meshStandardMaterial
          color={isSelected ? '#3b82f6' : obj.properties.color}
          roughness={obj.properties.roughness}
          metalness={obj.properties.metalness}
          map={texture || undefined}
          vertexColors={!!obj.geometryData?.colors && !texture}
          side={THREE.DoubleSide}
        />
      </mesh>

      {isSelected && target && selectedObjectIds.length === 1 && (
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
  const { 
    objects, selectedObjectId, selectedObjectIds, 
    removeObject, duplicateObject, groupSelectedObjects 
  } = useEditorStore();

  // Keyboard shortcut for deleting, duplicating & grouping selected objects
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        removeObject(selectedObjectId);
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && selectedObjectId) {
        e.preventDefault();
        duplicateObject(selectedObjectId);
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G') && selectedObjectIds.length >= 2) {
        e.preventDefault();
        groupSelectedObjects('Group Assembly');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, selectedObjectIds, removeObject, duplicateObject, groupSelectedObjects]);

  // Only render top-level objects at root (children are rendered inside their parent group)
  const rootObjects = objects.filter((o) => !o.parentId);

  return (
    <group>
      {rootObjects.map((obj) => (
        <SingleMesh key={obj.id} obj={obj} />
      ))}
    </group>
  );
}
