'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Grid, ContactShadows, OrbitControls } from '@react-three/drei';
import { useEditorStore } from '@/lib/store/editorStore';
import ModelViewer from './ModelViewer';

export default function Workspace() {
  const isChatOpen = useEditorStore((state) => state.isChatOpen);

  return (
    <div className={`absolute top-11 right-80 bottom-0 bg-[#0b0c10] overflow-hidden transition-all duration-300 ${isChatOpen ? 'left-80' : 'left-0'}`}>
      <Canvas shadows camera={{ position: [2.5, 2.5, 4.5], fov: 45 }}>
        <color attach="background" args={['#0b0c10']} />
        
        {/* Studio Lighting setup */}
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[6, 12, 6]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={2048}
          shadow-bias={-0.0001}
        />
        <directionalLight
          position={[-6, 5, -6]}
          intensity={0.5}
          color="#3b82f6"
        />
        <pointLight position={[0, 8, 0]} intensity={0.4} color="#a855f7" />

        <OrbitControls makeDefault minDistance={1} maxDistance={25} enableDamping dampingFactor={0.05} />
        
        <Suspense fallback={null}>
          <Environment preset="city" />
          <ModelViewer />
        </Suspense>

        {/* Soft Ground Shadows */}
        <ContactShadows 
          position={[0, 0, 0]} 
          opacity={0.6} 
          scale={12} 
          blur={2.5} 
          far={5} 
          color="#000000"
        />
        
        {/* High Precision Studio Grid without fading/shadows */}
        <Grid 
          renderOrder={-1}
          position={[0, -0.01, 0]} 
          infiniteGrid 
          fadeDistance={100} 
          fadeStrength={0} 
          cellSize={0.5} 
          cellThickness={1} 
          cellColor="#3a4259" 
          sectionSize={2.5} 
          sectionThickness={1.8} 
          sectionColor="#3b82f6" 
        />
      </Canvas>
    </div>
  );
}
