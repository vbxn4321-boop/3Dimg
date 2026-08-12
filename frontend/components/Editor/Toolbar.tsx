'use client';

import React from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { Move, RotateCcw, Maximize } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Toolbar() {
  const { transformMode, setTransformMode } = useEditorStore();

  const modes = [
    { id: 'translate', icon: Move, label: '이동 (Move)' },
    { id: 'rotate', icon: RotateCcw, label: '회전 (Rotate)' },
    { id: 'scale', icon: Maximize, label: '크기 (Scale)' },
  ] as const;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center bg-[#0f1117]/90 backdrop-blur-xl border border-gray-800/80 p-1.5 rounded-2xl shadow-2xl space-x-1.5 z-20 select-none"
    >
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => setTransformMode(mode.id)}
          className={`px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center space-x-2 text-xs font-semibold
            ${transformMode === mode.id
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 border border-blue-500/40'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }
          `}
          title={mode.label}
        >
          <mode.icon size={15} strokeWidth={2.2} />
          <span className="font-sans text-[11px] font-bold">
            {mode.id === 'translate' ? '이동' : mode.id === 'rotate' ? '회전' : '크기'}
          </span>
        </button>
      ))}
    </motion.div>
  );
}
