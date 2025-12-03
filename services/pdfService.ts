import { PDFDocumentProxy } from '../types';

export const extractTextFromPDF = async (file: File): Promise<string> => {
  // 1. Define a timeout promise to prevent indefinite hanging
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error("PDF extraction timed out (20s). The file may be too large or the network is slow.")), 20000)
  );

  // 2. Define the extraction logic
  const extractionPromise = new Promise<string>(async (resolve, reject) => {
    try {
      if (typeof window === 'undefined' || !window.pdfjsLib) {
        throw new Error("PDF.js library is not loaded. Please check your internet connection and refresh the page.");
      }

      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      const loadingTask = window.pdfjsLib.getDocument({ data });
      const pdf: PDFDocumentProxy = await loadingTask.promise;

      let fullText = '';
      const totalPages = pdf.numPages;
      // Limit pages for performance, but increase slightly to cover more content
      const maxPagesToRead = Math.min(totalPages, 15);

      // 3. Parallelize page extraction for speed
      const pagePromises = [];
      for (let i = 1; i <= maxPagesToRead; i++) {
        pagePromises.push(
          pdf.getPage(i).then(async (page) => {
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str || '').join(' ');
            return { index: i, text };
          }).catch(err => {
            console.warn(`Failed to read page ${i}`, err);
            return { index: i, text: '' }; // Skip failed pages without breaking
          })
        );
      }

      const pageResults = await Promise.all(pagePromises);

      // 4. Reassemble text in order
      pageResults.sort((a, b) => a.index - b.index).forEach(({ index, text }) => {
        if (text.trim()) {
           fullText += `\n--- PAGE ${index} START ---\n${text}\n--- PAGE ${index} END ---\n`;
        }
      });

      if (!fullText.trim()) {
        throw new Error("Could not extract text. The PDF might be a scanned image.");
      }

      resolve(fullText);
    } catch (error: any) {
      console.error('PDF Extraction Error:', error);
      reject(new Error(error.message || "Unknown error during PDF extraction"));
    }
  });

  // Race between extraction and timeout
  return Promise.race([extractionPromise, timeoutPromise]);
};