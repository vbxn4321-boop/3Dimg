// ============================================================
// AntiGravity Multi-Agent I/O Schema Definitions
// 3Dimg Project - Day 1
// ============================================================

// ----------------------------
// Shared Types
// ----------------------------

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface AgentError {
  code: string;
  message: string;
  retryable: boolean;
}

// ----------------------------
// Vision Agent
// ----------------------------

export interface VisionAgentInput {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  backgroundRemoved: boolean;
}

export interface Keypoint3D {
  label: string;
  x: number; // normalized -1.0 to 1.0
  y: number; // normalized -1.0 to 1.0
  z: number; // normalized -1.0 to 1.0
}

export interface ParametricBounds {
  shapeType: "box" | "cylinder" | "sphere" | "extruded_polygon" | "rounded_prism";
  aspectWidth: number;   // relative scale X (e.g. 1.0)
  aspectHeight: number;  // relative scale Y (e.g. 2.5)
  aspectDepth: number;   // relative scale Z (e.g. 0.4)
  bevelRadius: number;   // corner chamfer/bevel radius (e.g. 0.05)
  polygonPoints?: Array<[number, number]>; // 2D contour normalized points [-1, 1]
  keypoints?: Keypoint3D[];
}

export interface VisionAgentOutput {
  objectName: string;               // e.g. "leather handbag"
  productModel?: string;            // e.g. "Nike Air Max 90", "iPhone 15 Pro" — for 3D model database lookup
  primaryMaterial: string;          // e.g. "genuine leather"
  estimatedColors: string[];        // e.g. ["#3B1F0A", "#5C3317"]
  hiddenAreas: string[];            // e.g. ["back strap detail", "interior lining"]
  styleKeywords: string[];          // e.g. ["luxury", "vintage", "minimalist"]
  confidence: number;               // 0.0 - 1.0
  rawDescription: string;           // Full LLM analysis text
  parametricBounds?: ParametricBounds; // Keypoint & parametric bounds for 3D geometry
}

// ----------------------------
// Dialogue Agent
// ----------------------------

export interface DialogueQuestion {
  id: string;
  category: "hidden_area" | "material" | "style" | "dimensions" | "detail";
  question: string;
  suggestions?: string[];           // Quick reply options
}

export interface DialogueAgentInput {
  visionOutput: VisionAgentOutput;
  conversationHistory: Message[];
  turnCount: number;
  collectedData?: CollectedData;
}

export interface DialogueAgentOutput {
  nextQuestion: DialogueQuestion | null;  // null when complete
  isComplete: boolean;
  assistantMessage: string;
  collectedData: CollectedData;
}

export interface CollectedData {
  backSideDescription?: string;
  internalDescription?: string;
  materialDetail?: string;
  styleGuide?: string;
  dimensions?: string;
  additionalDetails?: string[];
  userAnswers: Record<string, string>;
}

// ----------------------------
// 3D Prompt Agent
// ----------------------------

export interface ThreeDPromptAgentInput {
  visionOutput: VisionAgentOutput;
  collectedData: CollectedData;
  targetPlatform?: "tripo3d" | "meshy" | "generic";
}

export interface ThreeDPromptAgentOutput {
  positivePrompt: string;
  negativePrompt: string;
  style: string;
  material: string;
  generationParams: {
    quality?: "draft" | "standard" | "high";
    topology?: "tris" | "quads";
    targetPolyCount?: number;
    textureResolution?: 512 | 1024 | 2048;
    generateNormalMap?: boolean;
    generateRoughnessMap?: boolean;
  };
  estimatedGenTime?: number;        // seconds
}

// ----------------------------
// App-Level Session State
// ----------------------------

export type SessionPhase =
  | "idle"
  | "uploading"
  | "analyzing"
  | "chatting"
  | "generating"
  | "complete"
  | "error";

export interface SessionState {
  phase: SessionPhase;
  originalImageUrl?: string;
  processedImageUrl?: string;       // After background removal
  visionOutput?: VisionAgentOutput;
  conversationHistory: Message[];
  collectedData: CollectedData;
  threeDPrompt?: ThreeDPromptAgentOutput;
  modelUrl?: string;                // Generated .glb URL
  error?: AgentError;
}
