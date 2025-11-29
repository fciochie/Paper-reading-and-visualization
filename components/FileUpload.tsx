import React, { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isProcessing }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (isProcessing) return;
      
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type === 'application/pdf') {
          onFileSelect(file);
        } else {
          alert('Please upload a valid PDF file.');
        }
      }
    },
    [onFileSelect, isProcessing]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`
        border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
        ${isProcessing ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-500'}
      `}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileInput}
        disabled={isProcessing}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
          {isProcessing ? (
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          ) : (
            <Upload className="w-8 h-8 text-indigo-600" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          {isProcessing ? 'Processing Document...' : 'Upload Research Paper'}
        </h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          Drag & drop your PDF here, or click to browse. We'll analyze it and create a mind map.
        </p>
      </label>
    </div>
  );
};

export default FileUpload;