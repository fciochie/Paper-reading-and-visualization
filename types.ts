// Define the structure of the Mind Map data returned by Gemini
export interface MindMapNode {
  id: string;
  label: string;
  summary: string; // Brief explanation
  quote?: string; // Verbatim quote from the text
  pageNumber: number; // The page in the PDF where this concept is found
  children?: MindMapNode[];
  // Layout properties
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

export interface MindMapData {
  root: MindMapNode;
  markdownSummary: string; // Abstract
  researchReport: string; // Future research directions
}

export interface ProcessingStatus {
  step: 'idle' | 'extracting' | 'analyzing' | 'complete' | 'error';
  message?: string;
}

export type EdgeType = 'default' | 'straight' | 'step' | 'smoothstep' | 'simplebezier';
export type FontSize = 'small' | 'medium' | 'large';

export interface MindMapOptions {
  edgeType: EdgeType;
  fontSize: FontSize;
}

export type TabMode = 'map' | 'outline' | 'abstract' | 'report';

export interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

export interface PDFPageViewport {
  width: number;
  height: number;
  transform: number[];
}

export interface PDFRenderParams {
  canvasContext: CanvasRenderingContext2D;
  viewport: PDFPageViewport;
}

export interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

export interface TextContentItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
}

export interface TextContent {
  items: TextContentItem[];
  styles: any;
}

export interface PDFPageProxy {
  getTextContent: () => Promise<TextContent>;
  getViewport: (params: { scale: number }) => PDFPageViewport;
  render: (params: PDFRenderParams) => PDFRenderTask;
}

declare global {
  interface Window {
    pdfjsLib: {
      getDocument: (src: string | Uint8Array | { data: Uint8Array }) => { promise: Promise<PDFDocumentProxy> };
      GlobalWorkerOptions: {
        workerSrc: string;
      };
      Util: {
        transform: (m1: number[], m2: number[]) => number[];
      };
    };
  }
}