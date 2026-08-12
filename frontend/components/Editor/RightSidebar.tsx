'use client';

import React, { useState } from 'react';
import { useEditorStore, SceneObject } from '@/lib/store/editorStore';
import { 
  Box, Settings, PaintBucket, Trash2, Image as ImageIcon, 
  Layers, Upload, X, Folder, FolderPlus, FolderMinus, CheckSquare, Square, Copy 
} from 'lucide-react';

export default function RightSidebar() {
  const { 
    objects, selectedObjectId, selectedObjectIds, selectObject, toggleSelectObject,
    removeObject, duplicateObject, groupSelectedObjects, ungroupObject,
    updateObjectTransform, updateObjectProperties, updateObjectName,
    updateObjectParametricBounds 
  } = useEditorStore();
  
  const [activeTab, setActiveTab] = useState<'object' | 'geometry' | 'material'>('object');
  const selectedObject = objects.find(o => o.id === selectedObjectId);

  const handleTransformChange = (axis: 'x'|'y'|'z', value: number, type: 'position'|'rotation'|'scale') => {
    if (!selectedObject) return;
    const current = [...selectedObject[type]] as [number, number, number];
    const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    current[index] = value;
    updateObjectTransform(selectedObject.id, { [type]: current });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedObject || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateObjectProperties(selectedObject.id, { textureUrl: event.target.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveTexture = () => {
    if (!selectedObject) return;
    updateObjectProperties(selectedObject.id, { textureUrl: undefined });
  };

  // Helper to render tree node in Outliner
  const renderTreeItem = (obj: SceneObject, level = 0) => {
    const isSelected = selectedObjectIds.includes(obj.id);
    const children = objects.filter((c) => c.parentId === obj.id);

    return (
      <div key={obj.id} className="space-y-1">
        <div 
          onClick={(e) => toggleSelectObject(obj.id, e.shiftKey || e.ctrlKey || e.metaKey)}
          className={`flex items-center justify-between px-3 py-1.5 rounded-xl transition-all cursor-pointer select-none ${
            level > 0 ? 'ml-4' : ''
          } ${
            isSelected 
              ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-sm' 
              : 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className="flex items-center space-x-2 truncate">
            {obj.isGroup ? (
              <Folder size={14} className={isSelected ? 'text-amber-400' : 'text-gray-400'} />
            ) : (
              <Box size={14} className={isSelected ? 'text-blue-400' : 'text-gray-500'} />
            )}
            <span className={`truncate text-xs ${obj.isGroup ? 'font-bold text-amber-200' : 'font-medium'}`}>
              {obj.name}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSelectObject(obj.id, true);
              }}
              className="text-gray-500 hover:text-blue-400 p-0.5"
            >
              {isSelected ? <CheckSquare size={12} className="text-blue-400" /> : <Square size={12} />}
            </button>
          </div>
        </div>

        {/* Nested Children */}
        {obj.isGroup && children.map((child) => renderTreeItem(child, level + 1))}
      </div>
    );
  };

  const rootObjects = objects.filter((o) => !o.parentId);

  return (
    <div className="absolute right-0 top-11 bottom-0 w-80 bg-[#0f1117]/90 backdrop-blur-xl border-l border-gray-800/80 flex flex-col z-20 text-xs text-gray-300 select-none">
      
      {/* Outliner (Scene Graph) */}
      <div className="h-1/3 flex flex-col border-b border-gray-800/80">
        <div className="px-4 py-2.5 bg-[#161922] font-semibold text-gray-200 border-b border-gray-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="tracking-wide">장면 구성 (아웃라이너)</span>
            <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">{objects.length}개</span>
          </div>

          {/* Group / Ungroup Actions */}
          <div className="flex items-center space-x-1">
            {selectedObjectIds.length >= 2 && (
              <button
                onClick={() => groupSelectedObjects('그룹 묶음')}
                className="flex items-center space-x-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all"
                title="선택한 도형 그룹으로 묶기 (Ctrl+G)"
              >
                <FolderPlus size={12} />
                <span>그룹 묶기</span>
              </button>
            )}

            {selectedObject?.isGroup && (
              <button
                onClick={() => ungroupObject(selectedObject.id)}
                className="flex items-center space-x-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-[10px] font-bold transition-all"
                title="선택한 그룹 해제하기"
              >
                <FolderMinus size={12} />
                <span>그룹 해제</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {rootObjects.map((obj) => renderTreeItem(obj, 0))}
          {objects.length === 0 && (
            <div className="text-gray-500 text-center mt-8 font-medium">장면에 도형이 없습니다</div>
          )}
        </div>
      </div>

      {/* Properties Editor */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#0f1117]">
        {/* Tabs */}
        <div className="flex border-b border-gray-800/80 bg-[#161922]">
          <button 
            className={`flex-1 py-2.5 flex items-center justify-center space-x-1 font-medium transition-all ${
              activeTab === 'object' 
                ? 'text-blue-400 bg-[#0f1117] border-b-2 border-blue-500' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('object')}
          >
            <Settings size={13} /> <span>위치/크기</span>
          </button>
          <button 
            className={`flex-1 py-2.5 flex items-center justify-center space-x-1 font-medium transition-all ${
              activeTab === 'geometry' 
                ? 'text-blue-400 bg-[#0f1117] border-b-2 border-blue-500' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('geometry')}
          >
            <Layers size={13} /> <span>도형 수치</span>
          </button>
          <button 
            className={`flex-1 py-2.5 flex items-center justify-center space-x-1 font-medium transition-all ${
              activeTab === 'material' 
                ? 'text-blue-400 bg-[#0f1117] border-b-2 border-blue-500' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('material')}
          >
            <PaintBucket size={13} /> <span>재질/색상</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!selectedObject ? (
            <div className="text-gray-500 text-center mt-12 font-medium">아웃라이너에서 도형을 선택하세요</div>
          ) : (
            <>
              {/* TRANSFORM TAB */}
              {activeTab === 'object' && (
                <div className="space-y-4">
                  {/* Name & Duplicate & Delete */}
                  <div className="flex items-center justify-between space-x-2">
                    <input 
                      type="text" 
                      value={selectedObject.name} 
                      onChange={(e) => updateObjectName(selectedObject.id, e.target.value)}
                      className="flex-1 bg-gray-900 text-gray-100 px-3 py-1.5 rounded-xl border border-gray-800 focus:border-blue-500/60 outline-none font-semibold text-xs"
                    />
                    <button 
                      onClick={() => duplicateObject(selectedObject.id)}
                      className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl transition-colors"
                      title="도형 복사 (Ctrl+D)"
                    >
                      <Copy size={14} />
                    </button>
                    <button 
                      onClick={() => removeObject(selectedObject.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors"
                      title="도형 삭제 (Delete 키)"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Transform Controls */}
                  {[
                    { type: 'position', label: '위치 (Position)' },
                    { type: 'rotation', label: '회전 (Rotation)' },
                    { type: 'scale', label: '크기 (Scale)' }
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

              {/* GEOMETRY TAB */}
              {activeTab === 'geometry' && (
                <div className="space-y-4">
                  {selectedObject.isGroup ? (
                    <div className="text-gray-400 text-center py-6 leading-relaxed">그룹 묶음은 개별 수치가 없습니다.<br />하위 개별 도형을 선택해 주세요.</div>
                  ) : (
                    <>
                      {/* Shape Type Selector */}
                      <div className="space-y-2 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/70">
                        <div className="text-gray-400 font-semibold text-[11px] uppercase tracking-wider">도형 형태 종류</div>
                        <select
                          value={selectedObject.parametricBounds?.shapeType || 'rounded_prism'}
                          onChange={(e) => updateObjectParametricBounds(selectedObject.id, { shapeType: e.target.value as any })}
                          className="w-full bg-gray-950 text-gray-200 text-xs font-semibold border border-gray-800 rounded-xl p-2 outline-none focus:border-blue-500/60 cursor-pointer"
                        >
                          <option value="rounded_prism">둥근 상자 / 기둥 (Rounded Box)</option>
                          <option value="box">직육면체 상자 (Box)</option>
                          <option value="cylinder">원기둥 (Cylinder)</option>
                          <option value="sphere">구체 (Sphere)</option>
                        </select>
                      </div>

                      {/* Aspect Ratios: Width, Height, Depth */}
                      {[
                        { key: 'aspectWidth', label: '가로 폭 (Width X)', val: selectedObject.parametricBounds?.aspectWidth ?? 1.0 },
                        { key: 'aspectHeight', label: '높이 (Height Y)', val: selectedObject.parametricBounds?.aspectHeight ?? 1.0 },
                        { key: 'aspectDepth', label: '깊이 (Depth Z)', val: selectedObject.parametricBounds?.aspectDepth ?? 1.0 },
                        { key: 'bevelRadius', label: '모서리 둥글기 (Bevel 곡률)', val: selectedObject.parametricBounds?.bevelRadius ?? 0.05, max: 0.3, step: 0.01 }
                      ].map(({ key, label, val, max = 3.0, step = 0.05 }) => (
                        <div key={key} className="space-y-2 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/70">
                          <div className="flex justify-between text-gray-400 font-semibold text-[11px] uppercase tracking-wider">
                            <span>{label}</span>
                            <span className="text-blue-400 font-mono font-bold">{val.toFixed(2)}</span>
                          </div>
                          <input 
                            type="range" min="0.05" max={max} step={step}
                            value={val}
                            onChange={(e) => updateObjectParametricBounds(selectedObject.id, { [key]: parseFloat(e.target.value) })}
                            className="w-full accent-blue-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* MATERIAL TAB */}
              {activeTab === 'material' && (
                <div className="space-y-4">
                  {/* Texture Upload */}
                  <div className="space-y-2 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/70">
                    <div className="text-gray-400 font-semibold text-[11px] uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <ImageIcon size={13} className="text-blue-400" />
                        <span>이미지 텍스처 (사진 씌우기)</span>
                      </span>
                    </div>

                    {selectedObject.properties.textureUrl ? (
                      <div className="relative group rounded-xl overflow-hidden border border-gray-800 bg-gray-950 p-2 flex items-center space-x-3">
                        <img 
                          src={selectedObject.properties.textureUrl} 
                          alt="Texture Preview" 
                          className="w-12 h-12 object-cover rounded-lg border border-gray-800"
                        />
                        <div className="flex-1 truncate">
                          <p className="text-[11px] font-semibold text-gray-200 truncate">적용된 이미지</p>
                          <p className="text-[10px] text-gray-500">사용자 이미지 텍스처</p>
                        </div>
                        <button 
                          onClick={handleRemoveTexture}
                          className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                          title="텍스처 삭제"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-gray-800 hover:border-blue-500/50 rounded-xl cursor-pointer bg-gray-950/60 transition-all hover:bg-blue-600/10">
                        <Upload size={18} className="text-blue-400 mb-1" />
                        <span className="text-[11px] font-semibold text-gray-300">텍스처 이미지 업로드</span>
                        <span className="text-[10px] text-gray-500 mt-0.5">지원: PNG, JPG, WebP</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          className="hidden" 
                        />
                      </label>
                    )}
                  </div>

                  {/* Color */}
                  <div className="space-y-2 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/70">
                    <div className="text-gray-400 font-semibold text-[11px] uppercase tracking-wider">기본 색상</div>
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

                  {/* Roughness */}
                  <div className="space-y-2 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/70">
                    <div className="flex justify-between text-gray-400 font-semibold text-[11px] uppercase tracking-wider">
                      <span>표면 거칠기 (Roughness)</span>
                      <span className="text-blue-400 font-mono font-bold">{selectedObject.properties.roughness.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.01"
                      value={selectedObject.properties.roughness}
                      onChange={(e) => updateObjectProperties(selectedObject.id, { roughness: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Metalness */}
                  <div className="space-y-2 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/70">
                    <div className="flex justify-between text-gray-400 font-semibold text-[11px] uppercase tracking-wider">
                      <span>금속 질감 (Metalness)</span>
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
