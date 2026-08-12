import { create } from 'zustand';

export type TransformMode = 'translate' | 'rotate' | 'scale';

export interface GeometryData {
  vertices: number[];
  indices: number[];
  colors?: number[];
  normals?: number[];
  uvs?: number[];
}

export interface ModelProperties {
  color: string;
  roughness: number;
  metalness: number;
}

export interface SceneObject {
  id: string;
  name: string;
  geometryData: GeometryData;
  properties: ModelProperties;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

interface EditorState {
  objects: SceneObject[];
  selectedObjectId: string | null;

  addObject: (obj: Omit<SceneObject, 'id'>) => string;
  removeObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  updateObjectProperties: (id: string, props: Partial<ModelProperties>) => void;
  updateObjectTransform: (id: string, transform: Partial<{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number] }>) => void;
  updateObjectName: (id: string, name: string) => void;
  clearAllObjects: () => void;

  transformMode: TransformMode;
  setTransformMode: (mode: TransformMode) => void;

  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;

  isChatOpen: boolean;
  toggleChatOpen: () => void;

  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  objects: [],
  selectedObjectId: null,

  addObject: (obj) => {
    const id = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newObj: SceneObject = { ...obj, id };
    set((state) => ({
      objects: [...state.objects, newObj],
      selectedObjectId: id,
    }));
    return id;
  },

  removeObject: (id) => {
    set((state) => {
      const nextObjects = state.objects.filter((o) => o.id !== id);
      const nextSelectedId = state.selectedObjectId === id
        ? (nextObjects.length > 0 ? nextObjects[nextObjects.length - 1].id : null)
        : state.selectedObjectId;
      return {
        objects: nextObjects,
        selectedObjectId: nextSelectedId,
      };
    });
  },

  selectObject: (id) => set({ selectedObjectId: id }),

  updateObjectProperties: (id, props) => {
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === id ? { ...o, properties: { ...o.properties, ...props } } : o
      ),
    }));
  },

  updateObjectTransform: (id, transform) => {
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === id ? { ...o, ...transform } : o
      ),
    }));
  },

  updateObjectName: (id, name) => {
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === id ? { ...o, name } : o
      ),
    }));
  },

  clearAllObjects: () => set({ objects: [], selectedObjectId: null }),

  transformMode: 'translate',
  setTransformMode: (mode) => set({ transformMode: mode }),

  isGenerating: false,
  setIsGenerating: (isGenerating) => set({ isGenerating }),

  isChatOpen: true,
  toggleChatOpen: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

  selectedModel: 'gemini-3.6-flash',
  setSelectedModel: (selectedModel) => set({ selectedModel }),
}));
