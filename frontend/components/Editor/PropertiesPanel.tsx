'use client';

import React from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { motion } from 'framer-motion';
import { Sliders, Trash2, Box } from 'lucide-react';

export default function PropertiesPanel() {
  const { objects, selectedObjectId, updateObjectProperties, removeObject } = useEditorStore();

  const selectedObject = objects.find((o) => o.id === selectedObjectId);

  if (!selectedObject) return null;

  const { properties } = selectedObject;

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute right-6 top-[72px] w-80 bg-gray-900/85 backdrop-blur-2xl border border-gray-800 rounded-3xl shadow-2xl p-6 text-gray-200 z-10 space-y-6"
    >
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sliders size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-100">Properties</h2>
            <p className="text-xs text-gray-400 flex items-center space-x-1 mt-0.5">
              <Box size={12} className="text-blue-400" />
              <span className="truncate max-w-[140px]">{selectedObject.name}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => removeObject(selectedObject.id)}
          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors"
          title="객체 삭제 (Delete)"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Color</label>
          <div className="flex items-center space-x-3 bg-gray-950/80 p-2 rounded-2xl border border-gray-800">
            <input
              type="color"
              value={properties.color}
              onChange={(e) => updateObjectProperties(selectedObject.id, { color: e.target.value })}
              className="w-9 h-9 rounded-xl cursor-pointer bg-transparent border-0 p-0"
            />
            <span className="text-xs font-mono text-gray-300 font-semibold flex-1">
              {properties.color.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <label className="text-gray-400 uppercase font-bold tracking-wider">Roughness</label>
            <span className="text-blue-400 font-mono font-semibold">{properties.roughness.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={properties.roughness}
            onChange={(e) => updateObjectProperties(selectedObject.id, { roughness: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <label className="text-gray-400 uppercase font-bold tracking-wider">Metalness</label>
            <span className="text-blue-400 font-mono font-semibold">{properties.metalness.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={properties.metalness}
            onChange={(e) => updateObjectProperties(selectedObject.id, { metalness: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </motion.div>
  );
}
