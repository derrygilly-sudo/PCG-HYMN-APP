// src/utils/pdfExtractor.js

/**
 * Extracts text content from a PDF file using PDF.js (CDN) or native fallback parser.
 * @param {File} file
 * @returns {Promise<{ text: string, numPages: number, isImageOnly?: boolean }>}
 */
export const extractTextFromPdf = async (file) => {
  if (!file) return { text: '', numPages: 0, isImageOnly: false };

  // 1. Try PDF.js (dynamically injected via CDN for ultra-lightweight client bundle)
  try {
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
          } else {
            reject(new Error('PDF.js not loaded'));
          }
        };
        script.onerror = () => reject(new Error('Failed to load PDF.js'));
        document.head.appendChild(script);
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items
        .map((item) => (typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean);
      if (strings.length > 0) {
        fullText += (fullText ? '\n\n' : '') + strings.join(' ');
      }
    }

    const cleanText = fullText.trim();
    return {
      text: cleanText,
      numPages: pdf.numPages,
      isImageOnly: cleanText.length === 0,
    };
  } catch (err) {
    console.warn('PDF.js dynamic load failed or offline, using fallback:', err);
    return fallbackExtract(file);
  }
};

/**
 * Fallback lightweight text extractor using string and stream matching
 */
async function fallbackExtract(file) {
  try {
    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder('latin1');
    const raw = decoder.decode(uint8);

    const pageMatches = raw.match(/\/Type\s*\/Page[^s]/g);
    const numPages = pageMatches ? pageMatches.length : 1;

    // Search for uncompressed BT...ET text blocks
    const btMatches = raw.match(/BT[\s\S]*?ET/g);
    let extracted = '';
    if (btMatches) {
      for (const block of btMatches) {
        const textMatches = block.match(/\((.*?)\)\s*Tj/g) || block.match(/\[(.*?)\]\s*TJ/g);
        if (textMatches) {
          for (const tm of textMatches) {
            const cleaned = tm.replace(/^[([]|[)\]]\s*T[jJ]$/g, '').replace(/\\([()\\])/g, '$1');
            extracted += cleaned + ' ';
          }
        }
      }
    }

    const cleanText = extracted.trim();
    return {
      text: cleanText,
      numPages,
      isImageOnly: cleanText.length === 0,
    };
  } catch (e) {
    return { text: '', numPages: 1, isImageOnly: true };
  }
}
