'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import MenuBar from '@/components/Editor/MenuBar';
import ChatSidebar from '@/components/Editor/ChatSidebar';
import RightSidebar from '@/components/Editor/RightSidebar';
import Toolbar from '@/components/Editor/Toolbar';

// Import Workspace dynamically to disable SSR since it uses Three.js
const Workspace = dynamic(() => import('@/components/Editor/Workspace'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-gray-400 font-medium">Loading Workspace...</p>
    </div>
  ),
});

export default function EditorPage() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950 text-gray-200 selection:bg-blue-500/30 font-sans">
      <MenuBar />
      <Workspace />
      <ChatSidebar />
      <RightSidebar />
      <Toolbar />
    </div>
  );
}
