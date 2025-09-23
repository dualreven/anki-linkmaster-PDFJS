// Lightweight wrapper to initialize QWebChannel and access pdfHomeBridge

/**
 * Initialize QWebChannel and return a handle to the backend bridge
 * @returns {Promise<{bridge: any, onListUpdated: (cb: Function) => void}>}
 */
export function initPdfHomeChannel() {
  return new Promise((resolve, reject) => {
    try {
      // qt.webChannelTransport is injected by QtWebEngine when web channel is set
      if (!window.qt || !window.qt.webChannelTransport) {
        return reject(new Error('Qt webChannelTransport not available'));
      }
      // QWebChannel global comes from ../common/qwebchannel.js
      // eslint-disable-next-line no-undef
      const channel = new QWebChannel(window.qt.webChannelTransport, (chan) => {
        const bridge = chan.objects && chan.objects.pdfHomeBridge;
        if (!bridge) return reject(new Error('pdfHomeBridge not found on channel'));
        const onListUpdated = (cb) => {
          try { bridge.pdfListUpdated.connect(cb); } catch (_) {}
        };
        resolve({ bridge, onListUpdated });
      });
      // keep channel referenced
      try { window.__pdfHomeQWebChannel = channel; } catch (_) {}
    } catch (e) {
      reject(e);
    }
  });
}


/**
 * Convert File objects to base64 and send to backend via bridge.addPdfBatchFromBase64
 * @param {any} bridge - pdfHomeBridge object
 * @param {File[]} files - File objects (pdf)
 */
export async function addPdfsViaBridge(bridge, files) {
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const items = [];
  for (const f of files || []) {
    if (!f || !/\.pdf$/i.test(f.name)) continue;
    const dataUrl = await toBase64(f);
    const base64 = String(dataUrl).split(',')[1] || '';
    items.push({ filename: f.name, data_base64: base64 });
  }
  if (items.length === 0) return false;
  try { return await bridge.addPdfBatchFromBase64(items); } catch (_) { return false; }
}

/**
 * Show a hidden file input and return selected file list (Promise<File[]>)
 */
export function pickLocalPdfFiles() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      document.body.removeChild(input);
      resolve(files);
    }, { once: true });
    input.click();
  });
}
