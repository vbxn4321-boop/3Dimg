'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Move, Keyboard, Layers, PaintBucket, Download, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [activeCategory, setActiveCategory] = useState<'ai' | 'canvas' | 'keys' | 'assembly' | 'material'>('ai');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const categories = [
    { id: 'ai', label: 'AI 생성', icon: Sparkles },
    { id: 'canvas', label: '캔버스 조작', icon: Move },
    { id: 'keys', label: '단축키', icon: Keyboard },
    { id: 'assembly', label: '도형 조립/그룹', icon: Layers },
    { id: 'material', label: '텍스처 & 편집', icon: PaintBucket },
  ] as const;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto select-none">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl bg-[#0f1117] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-gray-200 my-auto z-[10000] relative"
        >
          {/* Header */}
          <div className="px-5 py-3.5 bg-[#161922] border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                <HelpCircle size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-100">3D Studio Pro 사용 가이드</h2>
                <p className="text-[11px] text-gray-400">에디터 사용법 및 단축키 안내</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Category Tabs */}
          <div className="flex border-b border-gray-800/80 bg-[#12141d] px-4 pt-2 space-x-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-t-xl transition-all ${
                  activeCategory === cat.id
                    ? 'bg-[#0f1117] text-blue-400 border-t-2 border-t-blue-500 border-x border-x-gray-800/80'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <cat.icon size={14} />
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs leading-relaxed text-gray-300">
            {activeCategory === 'ai' && (
              <div className="space-y-4">
                <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-2xl space-y-2">
                  <h3 className="text-sm font-bold text-blue-400 flex items-center space-x-2">
                    <Sparkles size={16} />
                    <span>대화형 3D 생성 (Text-to-3D)</span>
                  </h3>
                  <p>좌측 <strong>AI Assistant</strong> 패널에서 생성하고 싶은 3D 모델(예: "스마트폰", "나무 의자", "빨간 구체")을 텍스트로 입력하면 AI가 형태, 비율, 색상을 분석해 3D 모델을 즉시 씬에 배치합니다.</p>
                </div>

                <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-2xl space-y-2">
                  <h3 className="text-sm font-bold text-indigo-400">🤖 AI 모델 드롭다운 선택</h3>
                  <p>채팅 패널 상단의 드롭다운 메뉴에서 <code>Gemini 3.6 Flash</code>, <code>Gemini 3.1 Pro</code> 등 원하시는 AI 모델을 자유롭게 선택하여 생성할 수 있습니다.</p>
                </div>
              </div>
            )}

            {activeCategory === 'canvas' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900/60 border border-gray-800 p-3.5 rounded-2xl space-y-1">
                    <div className="font-bold text-gray-100 text-xs">🖱️ 마우스 좌클릭 드래그</div>
                    <div className="text-gray-400">카메라 시점 360도 회전 (Rotate)</div>
                  </div>
                  <div className="bg-gray-900/60 border border-gray-800 p-3.5 rounded-2xl space-y-1">
                    <div className="font-bold text-gray-100 text-xs">🖱️ 마우스 우클릭 드래그</div>
                    <div className="text-gray-400">카메라 위치 평행 이동 (Pan)</div>
                  </div>
                  <div className="bg-gray-900/60 border border-gray-800 p-3.5 rounded-2xl space-y-1">
                    <div className="font-bold text-gray-100 text-xs">🖱️ 마우스 휠 스크롤</div>
                    <div className="text-gray-400">카메라 확대 및 축소 (Zoom In / Out)</div>
                  </div>
                  <div className="bg-gray-900/60 border border-gray-800 p-3.5 rounded-2xl space-y-1">
                    <div className="font-bold text-gray-100 text-xs">🎯 하단 툴바 기즈모</div>
                    <div className="text-gray-400">이동(MOVE), 회전(ROTATE), 크기(SCALE) 조작</div>
                  </div>
                </div>
              </div>
            )}

            {activeCategory === 'keys' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800 p-3.5 rounded-2xl">
                  <div>
                    <div className="font-bold text-gray-100">선택 도형 즉시 그룹화 (Group)</div>
                    <div className="text-gray-400 text-[11px]">선택된 2개 이상의 도형을 즉시 레고 묶음으로 통합합니다.</div>
                  </div>
                  <kbd className="px-2.5 py-1 bg-gray-800 border border-gray-700 text-amber-400 rounded-lg font-mono font-bold text-xs">Ctrl + G</kbd>
                </div>

                <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800 p-3.5 rounded-2xl">
                  <div>
                    <div className="font-bold text-gray-100">선택 오브젝트 복제 (Duplicate)</div>
                    <div className="text-gray-400 text-[11px]">오브젝트의 색상, 텍스처, 모양 수치까지 완벽히 복제됩니다.</div>
                  </div>
                  <kbd className="px-2.5 py-1 bg-gray-800 border border-gray-700 text-blue-400 rounded-lg font-mono font-bold text-xs">Ctrl + D</kbd>
                </div>

                <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800 p-3.5 rounded-2xl">
                  <div>
                    <div className="font-bold text-gray-100">선택 오브젝트 삭제 (Delete)</div>
                    <div className="text-gray-400 text-[11px]">선택된 3D 오브젝트를 씬에서 삭제합니다.</div>
                  </div>
                  <kbd className="px-2.5 py-1 bg-gray-800 border border-gray-700 text-red-400 rounded-lg font-mono font-bold text-xs">Delete / Backspace</kbd>
                </div>

                <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800 p-3.5 rounded-2xl">
                  <div>
                    <div className="font-bold text-gray-100">3D 캔버스 / Outliner 다중 선택 (Multi-Select)</div>
                    <div className="text-gray-400 text-[11px]">3D 화면이나 아웃라이너에서 여러 도형을 한 번에 다중 선택합니다.</div>
                  </div>
                  <kbd className="px-2.5 py-1 bg-gray-800 border border-gray-700 text-amber-400 rounded-lg font-mono font-bold text-xs">Shift + 클릭</kbd>
                </div>
              </div>
            )}

            {activeCategory === 'assembly' && (
              <div className="space-y-4">
                <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-2xl space-y-2">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center space-x-2">
                    <Layers size={16} />
                    <span>도형 결합 & 그룹화 (Lego Assembly)</span>
                  </h3>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-300">
                    <li><strong>3D 캔버스 화면</strong> 또는 우측 <strong>Outliner</strong>에서 <code>Shift + 클릭</code>으로 2개 이상의 도형을 선택합니다.</li>
                    <li>키보드 <code>Ctrl + G</code> 단축키를 누르거나 아웃라이너의 <strong>"Group"</strong> 버튼을 누르면 하나로 통합됩니다.</li>
                    <li>그룹을 이동/회전하면 자식 도형들이 한 덩어리로 함께 움직입니다.</li>
                    <li>언제든 <strong>"Ungroup"</strong> 버튼을 눌러 개별 독립 도형으로 해제할 수 있습니다.</li>
                  </ol>
                </div>
              </div>
            )}

            {activeCategory === 'material' && (
              <div className="space-y-4">
                <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-2xl space-y-2">
                  <h3 className="text-sm font-bold text-blue-400">🖼️ 이미지 텍스처 업로드</h3>
                  <p>우측 패널의 <strong>Material 탭</strong>에서 PC의 이미지(스마트폰 화면, 나무 결 등)를 업로드하면 3D 표면에 입혀집니다.</p>
                </div>

                <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-2xl space-y-2">
                  <h3 className="text-sm font-bold text-indigo-400">📐 수동 지오메트리 수치 편집</h3>
                  <p>우측 패널의 <strong>Geometry 탭</strong>에서 모서리 둥글기(Bevel) 및 가로/세로/높이 비율을 슬라이더로 직접 편집할 수 있습니다.</p>
                </div>

                <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-2xl space-y-2">
                  <h3 className="text-sm font-bold text-green-400">💾 3D 파일 내보내기 (Export)</h3>
                  <p>상단 <strong>File</strong> 메뉴에서 <code>.GLB</code>, <code>.OBJ</code>, <code>.STL</code> 포맷으로 내보내어 Blender나 3D 프린터에서 활용할 수 있습니다.</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-[#161922] border-t border-gray-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-600/20 text-xs"
            >
              확인 (닫기)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
