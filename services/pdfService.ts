import { PDFDocumentProxy } from '../types';

export const extractTextFromPDF = async (file: File): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Ensure PDF.js is loaded
      if (typeof window === 'undefined' || !window.pdfjsLib) {
        throw new Error("PDF.js library is not loaded. Please refresh the page.");
      }

      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      // Call getDocument with the typed array
      const loadingTask = window.pdfjsLib.getDocument({ data });
      
      const pdf: PDFDocumentProxy = await loadingTask.promise;

      let fullText = '';
      const totalPages = pdf.numPages;

      // Limit to first 20 pages to ensure speed and reliability
      const maxPagesToRead = Math.min(totalPages, 20);

      for (let i = 1; i <= maxPagesToRead; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Safer text extraction
          const pageText = textContent.items
            .map((item: any) => item.str || '') // Handle missing str property safely
            .join(' ');
          
          if (pageText.trim()) {
             // Add a marker for the AI to know where pages start/end
             fullText += `\n--- PAGE ${i} START ---\n${pageText}\n--- PAGE ${i} END ---\n`;
          }
        } catch (pageError) {
          console.warn(`Error reading page ${i}`, pageError);
          // Continue to next page instead of failing completely
        }
      }

      if (!fullText.trim()) {
        throw new Error("Could not extract any text from the PDF. It might be scanned or image-based.");
      }

      resolve(fullText);
    } catch (error: any) {
      console.error('Error extracting text from PDF:', error);
      // Ensure we return a string message
      const errorMessage = error instanceof Error ? error.message : "Unknown error during PDF extraction";
      reject(new Error(errorMessage));
    }
  });
};
