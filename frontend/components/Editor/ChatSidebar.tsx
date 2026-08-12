'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { bufferGeometryToData } from '@/lib/utils/smart3DGenerator';
import { createParametricGeometry } from '@/lib/utils/parametricMeshGenerator';
import { Send, Loader2, Sparkles, ChevronLeft, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatSidebar() {
  const { 
    addObject, objects, selectedObjectId, isGenerating, setIsGenerating,
    isChatOpen, toggleChatOpen, selectedModel, setSelectedModel 
  } = useEditorStore();

  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    {
      role: 'ai',
      text: '안녕하세요! AI 3D 어시스턴트입니다. 원하시는 3D 모델(예: 스마트폰, 나무 의자, 원기둥 컵)을 설명해주시면 씬에 생성해 드립니다.',
    },
  ]);
  const [input, setInput] = useState('');

  const modelOptions = [
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Fast & Smart)' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (High Accuracy)' },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Ultra Fast)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Stable)' },
  ];

  const handleSendText = async (promptText?: string) => {
    const textToSend = promptText || input.trim();
    if (!textToSend || isGenerating) return;

    if (!promptText) setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: textToSend }]);

    setIsGenerating(true);
    setMessages((prev) => [
      ...prev,
      { role: 'ai', text: `'${textToSend}'에 맞춰 3D 객체를 씬에 추가하는 중입니다...` },
    ]);

    try {
      const res = await fetch('/api/text-to-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToSend, model: selectedModel })
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();

      const geom = createParametricGeometry(data.parametricBounds);
      const geometryData = bufferGeometryToData(geom);

      // Offset position slightly for multiple objects so they don't overlap directly
      const count = objects.length;
      const offsetX = (count % 3) * 1.5 - 1.5;
      const offsetZ = Math.floor(count / 3) * 1.5;

      addObject({
        name: data.objectName || textToSend,
        geometryData: geometryData,
        properties: {
          color: data.color || '#3b82f6',
          roughness: data.parametricBounds?.surfaceRoughness ?? 0.4,
          metalness: data.parametricBounds?.surfaceMetalness ?? 0.3,
        },
        position: [offsetX, 0, offsetZ],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: `✨ '${textToSend}' 객체가 씬에 새로 추가되었습니다! (현재 씬 객체: ${objects.length + 1}개)`,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: '죄송합니다. 3D 모델 생성 중 오류가 발생했습니다.' },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isChatOpen) {
    return (
      <motion.button
        initial={{ x: -10, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        onClick={toggleChatOpen}
        className="absolute left-0 top-20 bg-[#0f1117]/90 hover:bg-[#161922] backdrop-blur-xl border border-l-0 border-gray-800/80 px-3 py-2.5 rounded-r-xl shadow-2xl text-blue-400 hover:text-white z-30 transition-all flex items-center space-x-2 border-blue-500/30 group"
        title="AI 대화창 열기"
      >
        <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-semibold">AI 대화</span>
      </motion.button>
    );
  }

  return (
    <motion.div 
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute left-0 top-11 bottom-0 w-80 bg-[#0f1117]/95 backdrop-blur-xl border-r border-gray-800/80 flex flex-col z-20 text-xs text-gray-300 select-none shadow-2xl"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/80 bg-[#161922] flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles size={15} />
          </div>
          <div>
            <h2 className="text-xs font-bold text-gray-100">AI 3D 어시스턴트</h2>
            <p className="text-[10px] text-gray-400">텍스트 기반 3D 모델 생성기</p>
          </div>
        </div>

        <button
          onClick={toggleChatOpen}
          className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors"
          title="AI 대화창 닫기"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Model Selection Bar */}
      <div className="px-3 py-2 bg-[#12141d] border-b border-gray-800/60 flex items-center space-x-2">
        <Cpu size={14} className="text-indigo-400" />
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="flex-1 bg-gray-900 text-gray-200 text-[11px] font-medium border border-gray-800 rounded-lg px-2 py-1 outline-none focus:border-blue-500/60 transition-colors cursor-pointer"
        >
          {modelOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs shadow-md shadow-blue-600/20 font-medium'
                  : 'bg-gray-900/90 text-gray-200 rounded-bl-xs border border-gray-800'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-gray-900/90 border border-gray-800 text-gray-300 px-3.5 py-2.5 rounded-2xl rounded-bl-xs flex items-center space-x-2.5">
              <Loader2 size={16} className="animate-spin text-blue-400" />
              <span className="text-xs font-medium">AI가 3D 모델을 생성 중입니다...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#0f1117] border-t border-gray-800/80">
        <div className="flex items-center space-x-2 bg-gray-900 rounded-xl p-1.5 border border-gray-800 focus-within:border-blue-500/60 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            placeholder="생성할 3D 모델을 설명하세요... (예: 아이폰, 나무 의자)"
            className="flex-1 bg-transparent text-gray-100 text-xs focus:outline-none px-2 py-1 placeholder-gray-500 font-medium"
            disabled={isGenerating}
          />

          <button
            onClick={() => handleSendText()}
            disabled={!input.trim() || isGenerating}
            className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg transition-all disabled:opacity-40 shadow-md shadow-blue-600/20"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
