import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PDFDocumentProxy, PDFRenderTask, TextContent, PDFPageViewport } from '../types';
import { ZoomIn, ZoomOut, Palette } from 'lucide-react';

interface PDFViewerProps {
  file: File | null;
  currentPage: number; // Target page to scroll to
  highlightText?: string;
}

interface PDFPageProps {
    pdfDoc: PDFDocumentProxy;
    pageNum: number;
    scale: number;
    highlightText?: string;
    highlightColor: string;
    highlightOpacity: number;
    onVisible: (pageNum: number) => void;
}

// Sub-component for individual pages
const PDFPage: React.FC<PDFPageProps> = ({ 
    pdfDoc, 
    pageNum, 
    scale, 
    highlightText, 
    highlightColor, 
    highlightOpacity,
    onVisible 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const renderTaskRef = useRef<PDFRenderTask | null>(null);
    const [isRendered, setIsRendered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // 1. Intersection Observer for Lazy Loading & Visibility Tracking
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    onVisible(pageNum);
                } else {
                    setIsVisible(false);
                }
            },
            { rootMargin: '200px', threshold: 0.1 } // Render 200px before viewport
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [pageNum, onVisible]);

    // 2. Render Page Content
    useEffect(() => {
        if (!isVisible || !pdfDoc || !canvasRef.current) return;
        
        // If already rendered with same scale, skip
        // Note: In a real app we'd handle scale changes more robustly (re-render)
        // Here we just re-render if visible
        
        const render = async () => {
            if (renderTaskRef.current) {
                try { renderTaskRef.current.cancel(); } catch(e) {}
            }

            try {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale });

                const canvas = canvasRef.current!;
                const context = canvas.getContext('2d');
                if (!context) return;

                // Set dimensions
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // Render Canvas
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };
                const task = page.render(renderContext);
                renderTaskRef.current = task;
                await task.promise;

                // Render Text Layer
                if (textLayerRef.current) {
                    textLayerRef.current.innerHTML = '';
                    textLayerRef.current.style.width = `${viewport.width}px`;
                    textLayerRef.current.style.height = `${viewport.height}px`;
                    
                    const textContent = await page.getTextContent();
                    renderTextLayer(textContent, viewport, textLayerRef.current, highlightText, highlightColor, highlightOpacity);
                }
                
                setIsRendered(true);

            } catch (error: any) {
                if (error?.name !== 'RenderingCancelledException') {
                    console.error(`Error rendering page ${pageNum}:`, error);
                }
            }
        };

        render();

        return () => {
            if (renderTaskRef.current) {
                try { renderTaskRef.current.cancel(); } catch(e) {}
            }
        };
    }, [isVisible, pdfDoc, pageNum, scale, highlightText, highlightColor, highlightOpacity]);

    // Helper: Render Text Layer & Highlights
    const renderTextLayer = (textContent: TextContent, viewport: PDFPageViewport, container: HTMLElement, highlight?: string, color: string = '#fef08a', opacity: number = 0.5) => {
        // Normalize highlight text
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanHighlight = highlight ? normalize(highlight) : null;
        
        const highlightLayer = document.createElement('div');
        highlightLayer.className = 'pdf-highlight-layer';
        container.appendChild(highlightLayer);

        let matchFound = false;

        textContent.items.forEach((item) => {
            const tx = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
            const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));

            const span = document.createElement('span');
            span.textContent = item.str;
            span.style.fontFamily = item.fontName;
            span.style.fontSize = `${fontHeight}px`;
            span.style.left = `${tx[4]}px`;
            span.style.top = `${tx[5] - (fontHeight * 0.8)}px`; 
            container.appendChild(span);

            if (cleanHighlight && item.str.length > 3) {
                const cleanStr = normalize(item.str);
                // Fuzzy check
                if (cleanHighlight.includes(cleanStr) || cleanStr.includes(cleanHighlight)) {
                    matchFound = true;
                    const rect = document.createElement('div');
                    rect.className = 'highlight-rect';
                    rect.style.backgroundColor = color;
                    rect.style.opacity = opacity.toString();
                    rect.style.left = span.style.left;
                    rect.style.top = span.style.top;
                    rect.style.width = `${Math.max(item.width * scale, 10)}px`;
                    rect.style.height = `${fontHeight * 1.2}px`; 
                    highlightLayer.appendChild(rect);
                }
            }
        });
        
        // Auto-scroll to highlight if this is the target page
        // We only auto-scroll if this exact page was requested via props (handled by parent ref)
    };

    return (
        <div ref={containerRef} className="relative shadow-md mb-8 bg-white mx-auto min-h-[600px] transition-all" style={{ width: 'fit-content' }}>
            <canvas ref={canvasRef} className="block" />
            <div ref={textLayerRef} className="pdf-text-layer" />
        </div>
    );
};

// Main PDF Viewer Component
const PDFViewer: React.FC<PDFViewerProps> = ({ file, currentPage, highlightText }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.2); 
  const [highlightColor, setHighlightColor] = useState('#fef08a');
  const [highlightOpacity, setHighlightOpacity] = useState(0.5);
  const [visiblePage, setVisiblePage] = useState(1);

  // Load PDF
  useEffect(() => {
    if (!file) return;
    const loadPdf = async () => {
      try {
        const buffer = await file.arrayBuffer();
        if (!window.pdfjsLib) throw new Error("PDF.js library not loaded");
        const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };
    loadPdf();
  }, [file]);

  // Handle external navigation (clicking a map node)
  useEffect(() => {
      if (!pdfDoc) return;
      // Scroll to the specific page element
      const element = document.getElementById(`pdf-page-${currentPage}`);
      if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
  }, [currentPage, pdfDoc]);

  // Update visible page indicator
  const handlePageVisible = useCallback((pageNum: number) => {
      setVisiblePage(pageNum);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
      if (e.ctrlKey) {
          e.preventDefault();
          if (e.deltaY < 0) setScale(s => Math.min(s + 0.1, 3));
          else setScale(s => Math.max(s - 0.1, 0.5));
      }
  }, []);

  if (!file) return <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">No PDF</div>;

  return (
    <div className="w-full h-full bg-slate-800 flex flex-col relative">
       {/* Header Toolbar */}
       <div className="h-12 bg-slate-900 flex items-center px-4 text-white text-xs border-b border-slate-700 shrink-0 z-10 gap-4 overflow-x-auto no-scrollbar">
         <span className="font-semibold text-indigo-400 shrink-0 hidden md:inline">Doc Viewer</span>
         
         <div className="h-6 w-px bg-slate-700 shrink-0"></div>

         {/* Color Picker */}
         <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setHighlightColor('#fef08a')} className={`w-4 h-4 rounded-full bg-yellow-200 border-2 ${highlightColor === '#fef08a' ? 'border-white' : 'border-transparent'}`} />
            <button onClick={() => setHighlightColor('#bbf7d0')} className={`w-4 h-4 rounded-full bg-green-200 border-2 ${highlightColor === '#bbf7d0' ? 'border-white' : 'border-transparent'}`} />
            <button onClick={() => setHighlightColor('#bfdbfe')} className={`w-4 h-4 rounded-full bg-blue-200 border-2 ${highlightColor === '#bfdbfe' ? 'border-white' : 'border-transparent'}`} />
            <button onClick={() => setHighlightColor('#fbcfe8')} className={`w-4 h-4 rounded-full bg-pink-200 border-2 ${highlightColor === '#fbcfe8' ? 'border-white' : 'border-transparent'}`} />
         </div>

         {/* Saturation Slider */}
         <div className="flex items-center gap-2 w-24 shrink-0" title="Highlight Intensity">
            <Palette className="w-3 h-3 text-slate-400" />
            <input 
                type="range" 
                min="0.1" 
                max="0.9" 
                step="0.1" 
                value={highlightOpacity}
                onChange={(e) => setHighlightOpacity(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
         </div>

         <div className="h-6 w-px bg-slate-700 shrink-0"></div>

         {/* Zoom & Page Info */}
         <div className="flex items-center gap-2 ml-auto shrink-0">
            <button onClick={() => setScale(s => Math.max(s-0.1, 0.5))} className="p-1 hover:bg-slate-700 rounded"><ZoomOut className="w-4 h-4"/></button>
            <span className="w-10 text-center text-slate-400">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(s+0.1, 3.0))} className="p-1 hover:bg-slate-700 rounded"><ZoomIn className="w-4 h-4"/></button>
            
            <div className="bg-indigo-600 px-2 py-0.5 rounded text-white font-mono shadow-sm ml-2">
                Page {visiblePage} / {pdfDoc?.numPages || '-'}
            </div>
         </div>
       </div>

       {/* Continuous Scroll Container */}
       <div 
          ref={scrollContainerRef} 
          onWheel={handleWheel}
          className="flex-1 overflow-auto bg-slate-800/50 pt-8 pb-32 px-4"
       >
          <div className="flex flex-col items-center">
              {pdfDoc && Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1).map((pageNum) => (
                  <div id={`pdf-page-${pageNum}`} key={pageNum}>
                    <PDFPage 
                        pdfDoc={pdfDoc}
                        pageNum={pageNum}
                        scale={scale}
                        highlightText={pageNum === currentPage ? highlightText : undefined} // Only highlight on active page context or global if preferred
                        highlightColor={highlightColor}
                        highlightOpacity={highlightOpacity}
                        onVisible={handlePageVisible}
                    />
                  </div>
              ))}
          </div>
       </div>
    </div>
  );
};

export default PDFViewer;