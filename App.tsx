import React, { useState } from 'react';
import { extractTextFromPDF } from './services/pdfService';
import { generateMindMap } from './services/geminiService';
import { MindMapData, ProcessingStatus, TabMode } from './types';
import FileUpload from './components/FileUpload';
import MindMapGraph from './components/MindMapGraph';
import PDFViewer from './components/PDFViewer';
import OutlineView from './components/OutlineView';
import SummaryView from './components/SummaryView';
import ReportView from './components/ReportView';
import { Maximize2, Minimize2, BrainCircuit, RefreshCw, Layout, List, FileText, FlaskConical } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle' });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeQuote, setActiveQuote] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Tab State - Default to 'abstract' (formerly summary)
  const [activeTab, setActiveTab] = useState<TabMode>('abstract');

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setStatus({ step: 'extracting', message: 'Reading PDF contents...' });
    setMindMapData(null); // Reset previous data

    try {
      // 1. Extract Text
      const text = await extractTextFromPDF(selectedFile);
      
      // 2. Analyze with Gemini
      setStatus({ step: 'analyzing', message: 'Gemini is analyzing structure & generating research ideas...' });
      const data = await generateMindMap(text);
      
      setMindMapData(data);
      setStatus({ step: 'complete' });
      setActiveTab('abstract'); // Default to Abstract view
    } catch (error: any) {
      console.error("App Error:", error);
      let errorMsg = 'Failed to process document. Please try again.';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      }
      
      setStatus({ 
        step: 'error', 
        message: errorMsg
      });
    }
  };

  const handleNodeClick = (pageNumber: number, quote?: string) => {
    setCurrentPage(pageNumber);
    setActiveQuote(quote);
    if (!isSidebarOpen) setIsSidebarOpen(true);
  };

  const handleReset = () => {
    setFile(null);
    setMindMapData(null);
    setStatus({ step: 'idle' });
    setActiveQuote(undefined);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            ScholarMind
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
            {status.step === 'idle' && (
               <div className="text-sm text-slate-500 hidden sm:block">
                 Powered by Gemini 2.5 Flash
               </div>
            )}
             {status.step === 'complete' && (
              <button 
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Analyze New Paper
              </button>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* State: IDLE - Upload Screen */}
        {status.step === 'idle' && (
          <div className="absolute inset-0 z-20 bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-xl w-full">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-slate-800 mb-3">Understand Papers Faster</h2>
                  <p className="text-slate-600">
                    Upload a PDF to generate a Chinese summary, interactive mind map, and research ideas.
                  </p>
                </div>
                <FileUpload onFileSelect={handleFileSelect} isProcessing={false} />
            </div>
          </div>
        )}

        {/* State: PROCESSING - Overlay */}
        {(status.step === 'extracting' || status.step === 'analyzing') && (
           <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center">
             <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold text-slate-800 animate-pulse">{status.message}</h3>
                <p className="text-slate-500 mt-2 text-sm">This may take up to 30 seconds for large papers.</p>
             </div>
           </div>
        )}
        
        {/* State: ERROR */}
        {status.step === 'error' && (
            <div className="absolute inset-0 z-20 bg-white flex items-center justify-center">
                <div className="text-center max-w-md p-6 bg-red-50 rounded-xl border border-red-100 shadow-sm">
                    <h3 className="text-lg font-bold text-red-700 mb-2">Something went wrong</h3>
                    <p className="text-red-600 mb-4 text-sm whitespace-pre-wrap">{status.message}</p>
                    <button 
                        onClick={handleReset}
                        className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-50 font-medium transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        )}

        {/* State: COMPLETE (Split View) */}
        {file && status.step === 'complete' && (
            <>
                {/* Left Panel: PDF Viewer */}
                <div 
                  className={`relative transition-all duration-300 ease-in-out border-r border-slate-200 shadow-xl z-20
                    ${isSidebarOpen ? 'w-1/2' : 'w-12 bg-slate-100 hover:bg-slate-200 cursor-pointer'}
                  `}
                >
                    {isSidebarOpen ? (
                         <>
                            <button 
                                onClick={() => setIsSidebarOpen(false)}
                                className="absolute top-10 right-2 z-20 p-1.5 bg-white/80 backdrop-blur rounded-md shadow-sm hover:bg-white text-slate-600"
                                title="Minimize PDF"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </button>
                            {/* Pass currentPage as the initial scroll target */}
                            <PDFViewer file={file} currentPage={currentPage} highlightText={activeQuote} />
                         </>
                    ) : (
                        <div 
                            className="h-full flex flex-col items-center pt-4 gap-4" 
                            onClick={() => setIsSidebarOpen(true)}
                        >
                             <button className="p-2 rounded-lg bg-white shadow-sm text-indigo-600">
                                <Maximize2 className="w-5 h-5" />
                             </button>
                             <div className="writing-vertical-lr text-slate-500 font-medium tracking-wide text-sm rotate-180 uppercase">
                                Document Viewer
                             </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: Content (Abstract / Map / Outline / Research) */}
                <div className="flex-1 bg-slate-50 flex flex-col relative z-10">
                    
                    {/* Tab Navigation */}
                    <div className="bg-white border-b border-slate-200 px-4 flex items-center gap-1 shrink-0 h-10 overflow-x-auto no-scrollbar">
                         <button
                            onClick={() => setActiveTab('abstract')}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'abstract' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileText className="w-4 h-4" /> Abstract
                        </button>
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'map' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <Layout className="w-4 h-4" /> Map
                        </button>
                        <button
                            onClick={() => setActiveTab('outline')}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'outline' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <List className="w-4 h-4" /> Outline
                        </button>
                        <button
                            onClick={() => setActiveTab('report')}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'report' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <FlaskConical className="w-4 h-4" /> Research Ideas
                        </button>
                    </div>

                    {/* View Content */}
                    <div className="flex-1 relative overflow-hidden">
                        {mindMapData ? (
                            <>
                                <div className={`w-full h-full ${activeTab === 'abstract' ? 'block' : 'hidden'}`}>
                                    <SummaryView data={mindMapData} />
                                </div>

                                <div className={`w-full h-full ${activeTab === 'map' ? 'block' : 'hidden'}`}>
                                    <MindMapGraph data={mindMapData} onNodeClick={handleNodeClick} />
                                    <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow-sm border border-slate-200 text-xs text-slate-500 max-w-xs pointer-events-none">
                                        <div className="font-semibold text-slate-700 mb-1">Interactive Map</div>
                                        Click nodes to sync PDF.
                                    </div>
                                </div>
                                
                                <div className={`w-full h-full ${activeTab === 'outline' ? 'block' : 'hidden'}`}>
                                    <OutlineView data={mindMapData} onNodeClick={handleNodeClick} />
                                </div>
                                
                                <div className={`w-full h-full ${activeTab === 'report' ? 'block' : 'hidden'}`}>
                                    <ReportView data={mindMapData} />
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                Waiting for analysis...
                            </div>
                        )}
                    </div>
                </div>
            </>
        )}
      </main>
    </div>
  );
};

export default App;