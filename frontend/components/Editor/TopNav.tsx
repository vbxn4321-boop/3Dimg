'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { exportToGLTF, exportToOBJ, exportToSTL } from '@/lib/utils/export3D';
import { Download, ChevronDown, Trash2, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TopNav() {
  const { objects, clearAllObjects } = useEditorStore();
  const [showExport, setShowExport] = useState(false);

  return (
    <div className="absolute top-0 left-0 right-0 h-16 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800 flex items-center justify-between px-6 z-20">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
          3D
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Editor</h1>
        {objects.length > 0 && (
          <span className="flex items-center space-x-1 text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-full border border-gray-700 font-medium">
            <Box size={12} className="text-blue-400" />
            <span>객체 {objects.length}개</span>
          </span>
        )}
      </div>

      {objects.length > 0 && (
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (confirm('씬 안의 모든 3D 객체를 삭제하시겠습니까?')) {
                clearAllObjects();
              }
            }}
            className="flex items-center space-x-1.5 bg-gray-900 hover:bg-red-500/20 text-gray-400 hover:text-red-400 px-3 py-2 rounded-xl border border-gray-800 hover:border-red-500/30 transition-all text-xs font-semibold"
            title="전체 씬 초기화"
          >
            <Trash2 size={14} />
            <span>전체 삭제</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-600/20 font-medium text-sm"
            >
              <Download size={16} />
              <span>Export</span>
              <ChevronDown size={16} />
            </button>

            <AnimatePresence>
              {showExport && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-2"
                >
                  <button
                    onClick={() => {
                      exportToGLTF(objects);
                      setShowExport(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    Export as .GLB
                  </button>
                  <button
                    onClick={() => {
                      exportToOBJ(objects);
                      setShowExport(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    Export as .OBJ
                  </button>
                  <button
                    onClick={() => {
                      exportToSTL(objects);
                      setShowExport(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    Export as .STL
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
