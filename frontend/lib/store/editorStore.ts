import { create } from 'zustand';
import { ParametricBounds } from '@/lib/types/agentSchema';
import { createParametricGeometry } from '@/lib/utils/parametricMeshGenerator';
import { bufferGeometryToData } from '@/lib/utils/smart3DGenerator';

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
  textureUrl?: string;
}

export interface SceneObject {
  id: string;
  name: string;
  geometryData: GeometryData;
  properties: ModelProperties;
  parametricBounds?: ParametricBounds;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  parentId?: string;
  isGroup?: boolean;
}

interface EditorState {
  objects: SceneObject[];
  selectedObjectId: string | null;
  selectedObjectIds: string[];

  addObject: (obj: Omit<SceneObject, 'id'>) => string;
  duplicateObject: (id: string) => string | undefined;
  removeObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  toggleSelectObject: (id: string, multiSelect?: boolean) => void;
  groupSelectedObjects: (groupName?: string) => string | undefined;
  ungroupObject: (groupId: string) => void;
  updateObjectProperties: (id: string, props: Partial<ModelProperties>) => void;
  updateObjectTransform: (id: string, transform: Partial<{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number] }>) => void;
  updateObjectName: (id: string, name: string) => void;
  updateObjectParametricBounds: (id: string, bounds: Partial<ParametricBounds>) => void;
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

export const useEditorStore = create<EditorState>((set, get) => ({
  objects: [],
  selectedObjectId: null,
  selectedObjectIds: [],

  addObject: (obj) => {
    const id = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newObj: SceneObject = { ...obj, id };
    set((state) => ({
      objects: [...state.objects, newObj],
      selectedObjectId: id,
      selectedObjectIds: [id],
    }));
    return id;
  },

  duplicateObject: (id) => {
    const { objects } = get();
    const target = objects.find((o) => o.id === id);
    if (!target) return undefined;

    // IF TARGET IS A GROUP: Duplicate group container AND all of its child shapes
    if (target.isGroup) {
      const newGroupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const children = objects.filter((o) => o.parentId === id);

      const newGroupObj: SceneObject = {
        ...JSON.parse(JSON.stringify(target)),
        id: newGroupId,
        name: `${target.name} 복사본`,
        position: [target.position[0] + 0.5, target.position[1], target.position[2] + 0.5],
      };

      const newChildren: SceneObject[] = children.map((c, idx) => {
        const newChildId = `obj_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
        return {
          ...JSON.parse(JSON.stringify(c)),
          id: newChildId,
          parentId: newGroupId,
          name: `${c.name} 복사본`,
        };
      });

      set((state) => ({
        objects: [...state.objects, newGroupObj, ...newChildren],
        selectedObjectId: newGroupId,
        selectedObjectIds: [newGroupId],
      }));

      return newGroupId;
    }

    // IF TARGET IS A SINGLE OBJECT
    const newId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const copyObj: SceneObject = {
      ...JSON.parse(JSON.stringify(target)),
      id: newId,
      name: `${target.name} 복사본`,
      parentId: undefined, // Detach single duplicated object so it becomes a standalone object
      position: [target.position[0] + 0.4, target.position[1], target.position[2] + 0.4],
    };

    set((state) => ({
      objects: [...state.objects, copyObj],
      selectedObjectId: newId,
      selectedObjectIds: [newId],
    }));

    return newId;
  },

  removeObject: (id) => {
    set((state) => {
      // Also remove or detach children if deleting a group
      const nextObjects = state.objects
        .filter((o) => o.id !== id)
        .map((o) => (o.parentId === id ? { ...o, parentId: undefined } : o));

      const nextSelectedIds = state.selectedObjectIds.filter((i) => i !== id);
      const nextSelectedId = state.selectedObjectId === id
        ? (nextSelectedIds.length > 0 ? nextSelectedIds[nextSelectedIds.length - 1] : (nextObjects.length > 0 ? nextObjects[nextObjects.length - 1].id : null))
        : state.selectedObjectId;

      return {
        objects: nextObjects,
        selectedObjectId: nextSelectedId,
        selectedObjectIds: nextSelectedIds,
      };
    });
  },

  selectObject: (id) => set({ selectedObjectId: id, selectedObjectIds: id ? [id] : [] }),

  toggleSelectObject: (id, multiSelect = false) => {
    set((state) => {
      if (!multiSelect) {
        return { selectedObjectId: id, selectedObjectIds: [id] };
      }
      const exists = state.selectedObjectIds.includes(id);
      const nextSelectedIds = exists
        ? state.selectedObjectIds.filter((i) => i !== id)
        : [...state.selectedObjectIds, id];
      const nextSelectedId = nextSelectedIds.length > 0 ? nextSelectedIds[nextSelectedIds.length - 1] : null;
      return {
        selectedObjectId: nextSelectedId,
        selectedObjectIds: nextSelectedIds,
      };
    });
  },

  groupSelectedObjects: (groupName = 'Group') => {
    const { selectedObjectIds, objects } = get();
    if (selectedObjectIds.length < 2) return undefined;

    const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Create dummy group container object at center of selected items
    const selectedObjects = objects.filter((o) => selectedObjectIds.includes(o.id));
    const avgX = selectedObjects.reduce((acc, o) => acc + o.position[0], 0) / selectedObjects.length;
    const avgY = selectedObjects.reduce((acc, o) => acc + o.position[1], 0) / selectedObjects.length;
    const avgZ = selectedObjects.reduce((acc, o) => acc + o.position[2], 0) / selectedObjects.length;

    const groupObj: SceneObject = {
      id: groupId,
      name: groupName,
      isGroup: true,
      geometryData: { vertices: [], indices: [] },
      properties: { color: '#ffffff', roughness: 0.5, metalness: 0.1 },
      position: [avgX, avgY, avgZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };

    set((state) => ({
      objects: [
        ...state.objects.map((o) =>
          selectedObjectIds.includes(o.id) ? { ...o, parentId: groupId } : o
        ),
        groupObj,
      ],
      selectedObjectId: groupId,
      selectedObjectIds: [groupId],
    }));

    return groupId;
  },

  ungroupObject: (groupId) => {
    set((state) => ({
      objects: state.objects
        .filter((o) => o.id !== groupId) // delete group container
        .map((o) => (o.parentId === groupId ? { ...o, parentId: undefined } : o)),
      selectedObjectId: null,
      selectedObjectIds: [],
    }));
  },

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

  updateObjectParametricBounds: (id, bounds) => {
    set((state) => ({
      objects: state.objects.map((o) => {
        if (o.id !== id) return o;
        const newBounds: ParametricBounds = {
          shapeType: bounds.shapeType || o.parametricBounds?.shapeType || 'rounded_prism',
          aspectWidth: bounds.aspectWidth ?? o.parametricBounds?.aspectWidth ?? 1.0,
          aspectHeight: bounds.aspectHeight ?? o.parametricBounds?.aspectHeight ?? 1.0,
          aspectDepth: bounds.aspectDepth ?? o.parametricBounds?.aspectDepth ?? 1.0,
          bevelRadius: bounds.bevelRadius ?? o.parametricBounds?.bevelRadius ?? 0.05,
          surfaceRoughness: bounds.surfaceRoughness ?? o.parametricBounds?.surfaceRoughness ?? o.properties.roughness,
          surfaceMetalness: bounds.surfaceMetalness ?? o.parametricBounds?.surfaceMetalness ?? o.properties.metalness,
        };
        const geom = createParametricGeometry(newBounds);
        const geometryData = bufferGeometryToData(geom);
        return {
          ...o,
          parametricBounds: newBounds,
          geometryData: geometryData,
        };
      }),
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
