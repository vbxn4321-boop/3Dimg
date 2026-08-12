'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { Box, Settings, PaintBucket, Trash2 } from 'lucide-react';

export default function RightSidebar() {
  const { 
    objects, selectedObjectId, selectObject, removeObject, 
    updateObjectTransform, updateObjectProperties, updateObjectName 
  } = useEditorStore();
  
  const [activeTab, setActiveTab] = useState<'object' | 'material'>('object');
  const selectedObject = objects.find(o => o.id === selectedObjectId);

  const handleTransformChange = (axis: 'x'|'y'|'z', value: number, type: 'position'|'rotation'|'scale') => {
    if (!selectedObject) return;
    const current = [...selectedObject[type]] as [number, number, number];
    const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    current[index] = value;
    updateObjectTransform(selectedObject.id, { [type]: current });
  };

  return (
    <div className="absolute right-0 top-11 bottom-0 w-80 bg-[#0f1117]/90 backdrop-blur-xl border-l border-gray-800/80 flex flex-col z-20 text-xs text-gray-300 select-none">
      
      {/* Outliner (Scene Graph) */}
      <div className="h-1/3 flex flex-col border-b border-gray-800/80">
        <div className="px-4 py-2.5 bg-[#161922] font-semibold text-gray-200 border-b border-gray-800/80 flex items-center justify-between">
          <span className="tracking-wide">Outliner</span>
          <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">{objects.length} Objects</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {objects.map((obj) => (
            <div 
              key={obj.id}
              onClick={() => selectObject(obj.id)}
              className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                selectedObjectId === obj.id 
                  ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-sm' 
                  : 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <Box size={15} className={selectedObjectId === obj.id ? 'text-blue-400' : 'text-gray-500'} />
                <span className="truncate font-medium">{obj.name}</span>
              </div>
            </div>
          ))}
          {objects.length === 0 && (
            <div className="text-gray-500 text-center mt-8 font-medium">Scene is empty</div>
          )}
        </div>
      </div>

      {/* Properties Editor */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#0f1117]">
        {/* Tabs */}
        <div className="flex border-b border-gray-800/80 bg-[#161922]">
          <button 
            className={`flex-1 py-2.5 flex items-center justify-center space-x-1.5 font-medium transition-all ${
              activeTab === 'object' 
                ? 'text-blue-400 bg-[#0f1117] border-b-2 border-blue-500' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('object')}
          >
            <Settings size={14} /> <span>Transform</span>
          </button>
          <button 
            className={`flex-1 py-2.5 flex items-center justify-center space-x-1.5 font-medium transition-all ${
              activeTab === 'material' 
                ? 'text-blue-400 bg-[#0f1117] border-b-2 border-blue-500' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('material')}
          >
            <PaintBucket size={14} /> <span>Material</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!selectedObject ? (
            <div className="text-gray-500 text-center mt-12 font-medium">Select an object from Outliner</div>
          ) : (
            <>
              {activeTab === 'object' && (
                <div className="space-y-4">
                  {/* Name & Delete */}
                  <div className="flex items-center justify-between space-x-2">
                    <input 
                      type="text" 
                      value={selectedObject.name} 
                      onChange={(e) => updateObjectName(selectedObject.id, e.target.value)}
                      className="flex-1 bg-gray-900 text-gray-100 px-3 py-1.5 rounded-xl border border-gray-800 focus:border-blue-500/60 outline-none font-semibold"
                    />
                    <button 
                      onClick={() => removeObject(selectedObject.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors"
                      title="Delete Object"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Transform Controls */}
                  {[
                    { type: 'position', label: 'Position' },
                    { type: 'rotation', label: 'Rotation' },
                    { type: 'scale', label: 'Scale' }
                  ].map(({ type, label }) => (
                    <div key={type} className="space-y-2 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/70">
                      <div className="text-gray-400 font-semibold text-[11px] uppercase tracking-wider">{label}</div>
                      <div className="flex space-x-2">
                        {[
                          { axis: 'x', bg: 'bg-red-500/20 text-red-400 border-red-500/30' },
                          { axis: 'y', bg: 'bg-green-500/20 text-green-400 border-green-500/30' },
                          { axis: 'z', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
                        ].map(({ axis, bg }, i) => (
                          <div key={axis} className="flex-1 flex items-center bg-gray-950 rounded-xl border border-gray-800 overflow-hidden focus-within:border-blue-500/60">
                            <div className={`w-5 py-1.5 flex justify-center text-[10px] font-extrabold uppercase border-r ${bg}`}>
                              {axis}
                            </div>
                            <input 
                              type="number"
                              step={type === 'scale' ? 0.1 : 0.5}
                              value={Number(selectedObject[type as 'position'|'rotation'|'scale'][i]).toFixed(2)}
                              onChange={(e) => handleTransformChange(axis as 'x'|'y'|'z', parseFloat(e.target.value) || 0, type as 'position'|'rotation'|'scale')}
                              className="w-full bg-transparent text-gray-200 p-1 text-[11px] font-mono text-center outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'material' && (
                <div className="space-y-4">
                  <div className="space-y-2 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/70">
                    <div className="text-gray-400 font-semibold text-[11px] uppercase tracking-wider">Color</div>
                    <div className="flex items-center space-x-3 bg-gray-950 p-2 rounded-xl border border-gray-800">
                      <input 
                        type="color" 
                        value={selectedObject.properties.color}
                        onChange={(e) => updateObjectProperties(selectedObject.id, { color: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                      />
                      <input 
                        type="text" 
                        value={selectedObject.properties.color.toUpperCase()}
                        onChange={(e) => updateObjectProperties(selectedObject.id, { color: e.target.value })}
                        className="flex-1 bg-transparent text-gray-200 px-2 py-1 outline-none font-mono text-xs uppercase font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/70">
                    <div className="flex justify-between text-gray-400 font-semibold text-[11px] uppercase tracking-wider">
                      <span>Roughness</span>
                      <span className="text-blue-400 font-mono font-bold">{selectedObject.properties.roughness.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.01"
                      value={selectedObject.properties.roughness}
                      onChange={(e) => updateObjectProperties(selectedObject.id, { roughness: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/70">
                    <div className="flex justify-between text-gray-400 font-semibold text-[11px] uppercase tracking-wider">
                      <span>Metalness</span>
                      <span className="text-blue-400 font-mono font-bold">{selectedObject.properties.metalness.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.01"
                      value={selectedObject.properties.metalness}
                      onChange={(e) => updateObjectProperties(selectedObject.id, { metalness: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
