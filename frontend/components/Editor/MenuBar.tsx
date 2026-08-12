'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { exportToGLTF, exportToOBJ, exportToSTL } from '@/lib/utils/export3D';
import { generate3DFromPrompt } from '@/lib/utils/smart3DGenerator';
import { createParametricGeometry } from '@/lib/utils/parametricMeshGenerator';
import { bufferGeometryToData } from '@/lib/utils/smart3DGenerator';
import { ChevronDown, Box, Cylinder, Circle, MessageSquare, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MenuBar() {
  const { objects, clearAllObjects, addObject, isChatOpen, toggleChatOpen } = useEditorStore();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const addPrimitive = (shapeType: 'box' | 'cylinder' | 'sphere') => {
    const geom = createParametricGeometry({
      shapeType: shapeType as any,
      aspectWidth: 1,
      aspectHeight: 1,
      aspectDepth: 1,
      bevelRadius: shapeType === 'box' ? 0.05 : 0
    });
    
    const count = objects.length;
    const offsetX = (count % 3) * 1.5 - 1.5;
    
    addObject({
      name: `New ${shapeType}`,
      geometryData: bufferGeometryToData(geom),
      properties: { color: '#ffffff', roughness: 0.5, metalness: 0.1 },
      position: [offsetX, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    });
    setActiveMenu(null);
  };

  return (
    <div className="absolute top-0 left-0 right-0 h-11 bg-[#0f1117]/90 backdrop-blur-xl border-b border-gray-800/80 flex items-center px-4 z-30 text-xs text-gray-300 select-none">
      <div className="font-bold text-white mr-6 flex items-center space-x-2">
        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-500/30 text-[11px] font-extrabold">
          3D
        </div>
        <span className="tracking-wide text-sm font-semibold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Studio Pro
        </span>
      </div>

      <div className="flex items-center space-x-1 font-medium">
        {/* File Menu */}
        <div className="relative">
          <button 
            className={`px-3 py-1.5 rounded-lg transition-all ${activeMenu === 'file' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-gray-800/60 hover:text-white'}`}
            onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
          >
            File
          </button>
          
          <AnimatePresence>
            {activeMenu === 'file' && (
              <motion.div 
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1.5 w-52 bg-[#161922] border border-gray-800 rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden"
              >
                <div className="px-4 py-2 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors" onClick={() => { exportToGLTF(objects); setActiveMenu(null); }}>Export as .GLB</div>
                <div className="px-4 py-2 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors" onClick={() => { exportToOBJ(objects); setActiveMenu(null); }}>Export as .OBJ</div>
                <div className="px-4 py-2 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors" onClick={() => { exportToSTL(objects); setActiveMenu(null); }}>Export as .STL</div>
                <div className="h-px bg-gray-800/80 my-1" />
                <div className="px-4 py-2 hover:bg-red-500/20 hover:text-red-400 text-red-400/90 cursor-pointer transition-colors" onClick={() => { 
                  if(confirm('Clear entire scene?')) clearAllObjects(); 
                  setActiveMenu(null); 
                }}>Clear Entire Scene</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Add Menu */}
        <div className="relative">
          <button 
            className={`px-3 py-1.5 rounded-lg transition-all ${activeMenu === 'add' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-gray-800/60 hover:text-white'}`}
            onClick={() => setActiveMenu(activeMenu === 'add' ? null : 'add')}
          >
            Add Primitive
          </button>
          
          <AnimatePresence>
            {activeMenu === 'add' && (
              <motion.div 
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1.5 w-48 bg-[#161922] border border-gray-800 rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden"
              >
                <div className="px-4 py-2 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center space-x-2.5 transition-colors" onClick={() => addPrimitive('box')}>
                  <Box size={15} className="text-blue-400" /> <span>Box</span>
                </div>
                <div className="px-4 py-2 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center space-x-2.5 transition-colors" onClick={() => addPrimitive('sphere')}>
                  <Circle size={15} className="text-indigo-400" /> <span>Sphere</span>
                </div>
                <div className="px-4 py-2 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center space-x-2.5 transition-colors" onClick={() => addPrimitive('cylinder')}>
                  <Cylinder size={15} className="text-purple-400" /> <span>Cylinder</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Invisible backdrop to close menus */}
      {activeMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
      )}
    </div>
  );
}
