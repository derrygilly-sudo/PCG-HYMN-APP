// src/services/pdfService.js
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

const SUPABASE_AUDIO_STORAGE_URL =
  'https://byynncyyhpyqqisacbft.supabase.co/storage/v1/object/public/audio';

/**
 * Checks if a given string represents a PDF file (URL, path, or data URI)
 * rather than plain text notation.
 */
export const isPdfDocument = (value) => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim().toLowerCase();

  // If it contains newlines or looks like plain solfa text without URLs
  if (trimmed.includes('\n') && !trimmed.startsWith('http')) {
    return false;
  }

  // Common PDF indicators
  if (trimmed.endsWith('.pdf') || trimmed.includes('.pdf?') || trimmed.includes('.pdf#')) {
    return true;
  }

  if (trimmed.startsWith('data:application/pdf')) {
    return true;
  }

  // Remote Supabase storage or web URL that contains pdf in path
  if ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && trimmed.includes('.pdf')) {
    return true;
  }

  // Local file URI ending with pdf
  if (trimmed.startsWith('file://') && trimmed.includes('.pdf')) {
    return true;
  }

  return false;
};

/**
 * Resolves a raw file path or filename to a complete public URL
 */
export const resolvePdfUrl = (rawPath) => {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed) return null;

  // Already a full remote URL, local file, or data URI
  if (/^(https?:\/\/|file:\/\/|data:)/i.test(trimmed)) {
    return trimmed;
  }

  // Relative storage path: clean and prefix with Supabase bucket
  let clean = trimmed.replace(/^\/+/, '');
  if (clean.toLowerCase().startsWith('audio/')) {
    clean = clean.slice(6);
  }

  return `${SUPABASE_AUDIO_STORAGE_URL}/${clean}`;
};

/**
 * Local offline storage directory for PDF sheet scores
 */
export const getScoresDirectory = () => {
  return (FileSystem.documentDirectory || '') + 'scores/';
};

export const ensureScoresDirectory = async () => {
  const dir = getScoresDirectory();
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
};

/**
 * Check if a hymn's score PDF is already cached locally
 */
export const getLocalPdfPath = async (hymnId, type = 'solfa') => {
  try {
    const dir = getScoresDirectory();
    const filePath = `${dir}hymn_${hymnId}_${type}.pdf`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists && (info.size || 0) > 0) {
      return filePath;
    }
    return null;
  } catch (e) {
    return null;
  }
};

/**
 * Download and cache a score PDF locally on the device for offline viewing
 */
export const downloadAndCachePdf = async (hymnId, type, rawUrl, onProgress) => {
  try {
    const fullUrl = resolvePdfUrl(rawUrl);
    if (!fullUrl) throw new Error('Invalid PDF URL');

    const dir = await ensureScoresDirectory();
    const targetPath = `${dir}hymn_${hymnId}_${type}.pdf`;

    const downloadResumable = FileSystem.createDownloadResumable(
      fullUrl,
      targetPath,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          (downloadProgress.totalBytesExpectedToWrite || 1);
        if (onProgress) {
          onProgress(Math.min(1, Math.max(0, progress)));
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (result && result.uri) {
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      return { success: true, uri: result.uri, size: fileInfo.size || 0 };
    }
    return { success: false, error: 'Download failed' };
  } catch (error) {
    console.error('downloadAndCachePdf error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove cached PDF from device storage
 */
export const deleteCachedPdf = async (hymnId, type = 'solfa') => {
  try {
    const dir = getScoresDirectory();
    const filePath = `${dir}hymn_${hymnId}_${type}.pdf`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      await FileSystem.deleteAsync(filePath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Share or open PDF in device default reader
 */
export const shareOrOpenPdf = async (pdfUrlOrPath, title = 'Hymn Sheet Music') => {
  try {
    let localUri = pdfUrlOrPath;

    // If it's a remote URL, download temporarily to cache
    if (/^https?:\/\//i.test(pdfUrlOrPath)) {
      const tempPath = `${FileSystem.cacheDirectory}hymn_score_view_${Date.now()}.pdf`;
      const downloadRes = await FileSystem.downloadAsync(pdfUrlOrPath, tempPath);
      localUri = downloadRes.uri;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable && localUri) {
      await Sharing.shareAsync(localUri, {
        mimeType: 'application/pdf',
        dialogTitle: title,
        UTI: 'com.adobe.pdf',
      });
      return { success: true };
    }

    // Fallback to browser
    if (/^https?:\/\//i.test(pdfUrlOrPath)) {
      await WebBrowser.openBrowserAsync(pdfUrlOrPath);
      return { success: true };
    }

    return { success: false, error: 'Sharing not available' };
  } catch (error) {
    console.error('shareOrOpenPdf error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate mobile-optimized PDF.js HTML viewer for WebView
 */
export const generatePdfViewerHtml = ({
  pdfUrl = '',
  base64Data = null,
  darkMode = false,
  title = 'Hymn Score',
}) => {
  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const text = darkMode ? '#f1f5f9' : '#0f172a';
  const mutedText = darkMode ? '#94a3b8' : '#64748b';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const primary = '#18227c';
  const primaryLight = '#eef2ff';

  // Either base64 or URL
  const dataInitCode = base64Data
    ? `const rawPdfData = atob("${base64Data}");
       const loadingTask = pdfjsLib.getDocument({ data: rawPdfData });`
    : `const loadingTask = pdfjsLib.getDocument("${pdfUrl}");`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>${title}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    body {
      background-color: ${bg};
      color: ${text};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 8px 6px 60px;
      user-select: none;
    }
    #toolbar {
      position: sticky;
      top: 6px;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 8px;
      background: ${cardBg};
      padding: 6px 14px;
      border-radius: 30px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12);
      border: 1px solid ${border};
      margin-bottom: 12px;
    }
    .btn {
      background: ${primaryLight};
      color: ${primary};
      border: none;
      font-weight: 700;
      font-size: 14px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn:active {
      transform: scale(0.92);
      opacity: 0.8;
    }
    .info {
      font-size: 12px;
      font-weight: 600;
      color: ${mutedText};
      padding: 0 6px;
    }
    #viewer-container {
      width: 100%;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .page-wrapper {
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      border-radius: 8px;
      overflow: hidden;
      max-width: 100%;
      display: flex;
      justify-content: center;
    }
    canvas {
      display: block;
      max-width: 100%;
      height: auto !important;
    }
    #loading {
      margin-top: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: ${mutedText};
      font-size: 14px;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3.5px solid ${border};
      border-top-color: ${primary};
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    #error-container {
      display: none;
      margin-top: 30px;
      padding: 20px;
      background: ${cardBg};
      border-radius: 12px;
      border: 1px solid ${border};
      text-align: center;
      max-width: 90%;
    }
    .retry-btn {
      margin-top: 12px;
      padding: 8px 18px;
      background: ${primary};
      color: #ffffff;
      border: none;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>

  <div id="toolbar">
    <button class="btn" id="zoom-out" title="Zoom Out">−</button>
    <span class="info" id="zoom-label">100%</span>
    <button class="btn" id="zoom-in" title="Zoom In">+</button>
    <button class="btn" id="zoom-reset" style="width: auto; border-radius: 16px; padding: 0 10px; font-size: 11px;">Fit</button>
    <span class="info" id="page-count">Loading...</span>
  </div>

  <div id="loading">
    <div class="spinner"></div>
    <span>Rendering sheet score...</span>
  </div>

  <div id="error-container">
    <p style="font-size: 14px; font-weight: 600; margin-bottom: 6px;">Unable to render score inside app</p>
    <p style="font-size: 12px; color: ${mutedText};">You can still open and view this sheet music using your device's PDF viewer.</p>
    <button class="retry-btn" onclick="openExternal()">Open in External Reader</button>
  </div>

  <div id="viewer-container"></div>

  <script>
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    let pdfDoc = null;
    let currentScale = 1.0;
    const container = document.getElementById('viewer-container');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error-container');
    const pageCountEl = document.getElementById('page-count');
    const zoomLabel = document.getElementById('zoom-label');

    function notify(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }

    function openExternal() {
      notify('OPEN_EXTERNAL', {});
    }

    async function renderPage(pageNum, scale) {
      const page = await pdfDoc.getPage(pageNum);
      const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);

      // Calculate responsive viewport based on screen width
      const baseViewport = page.getViewport({ scale: 1.0 });
      const availableWidth = Math.min(window.innerWidth - 16, 880);
      const fitScale = (availableWidth / baseViewport.width) * scale;
      const viewport = page.getViewport({ scale: fitScale });

      let wrapper = document.getElementById('page-wrapper-' + pageNum);
      let canvas;

      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'page-wrapper-' + pageNum;
        wrapper.className = 'page-wrapper';
        canvas = document.createElement('canvas');
        canvas.id = 'canvas-page-' + pageNum;
        wrapper.appendChild(canvas);
        container.appendChild(wrapper);
      } else {
        canvas = wrapper.querySelector('canvas');
      }

      const context = canvas.getContext('2d');
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
      };

      await page.render(renderContext).promise;
    }

    async function renderAllPages() {
      if (!pdfDoc) return;
      zoomLabel.innerText = Math.round(currentScale * 100) + '%';
      for (let num = 1; num <= pdfDoc.numPages; num++) {
        await renderPage(num, currentScale);
      }
    }

    document.getElementById('zoom-in').addEventListener('click', () => {
      if (currentScale < 2.5) {
        currentScale += 0.25;
        renderAllPages();
      }
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
      if (currentScale > 0.6) {
        currentScale -= 0.25;
        renderAllPages();
      }
    });

    document.getElementById('zoom-reset').addEventListener('click', () => {
      currentScale = 1.0;
      renderAllPages();
    });

    // Load PDF
    try {
      ${dataInitCode}
      loadingTask.promise.then(async (doc) => {
        pdfDoc = doc;
        loadingEl.style.display = 'none';
        pageCountEl.innerText = pdfDoc.numPages + (pdfDoc.numPages === 1 ? ' Page' : ' Pages');
        notify('LOADED', { pages: pdfDoc.numPages });
        await renderAllPages();
      }).catch((err) => {
        console.error('PDF load error:', err);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        notify('ERROR', { message: err.message });
      });
    } catch (e) {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      notify('ERROR', { message: e.message });
    }
  </script>
</body>
</html>
`;
};
