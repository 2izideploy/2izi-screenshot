const EXTENSION_BUILD = 'build-3';
console.log('[Quick Screenshot] background.js loaded:', EXTENSION_BUILD);

const JPEG_QUALITY = 0.92;
const CAPTURE_DELAY_MS = 350; // stay under captureVisibleTab rate limit

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function captureVisibleTabSafe(windowId) {
  let attempts = 0;
  while (attempts < 4) {
    try {
      return await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    } catch (err) {
      attempts++;
      if (attempts >= 4) throw err;
      await sleep(500);
    }
  }
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // avoid call stack overflow on large images
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  return `data:${blob.type};base64,${base64}`;
}

async function downloadBlobAsJpg(blob, prefix) {
  const dataUrl = await blobToDataUrl(blob);
  await chrome.downloads.download({
    url: dataUrl,
    filename: `${prefix}-${timestamp()}.jpg`,
    saveAs: false
  });
}

async function showToast(tabId, text) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg) => {
        const el = document.createElement('div');
        el.textContent = msg;
        Object.assign(el.style, {
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(20,20,20,0.9)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          fontFamily: 'sans-serif',
          zIndex: 2147483647,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
          transition: 'opacity 0.4s'
        });
        document.documentElement.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; }, 1600);
        setTimeout(() => el.remove(), 2200);
      },
      args: [text]
    });
  } catch (e) {
    // page may not allow injection (e.g. chrome:// pages) - ignore silently
  }
}

/* ---------------- FULL PAGE CAPTURE ---------------- */

function getPageMetrics() {
  return {
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    originalScrollX: window.scrollX,
    originalScrollY: window.scrollY
  };
}

function scrollPageTo(x, y) {
  window.scrollTo(x, y);
}

function setScrollLock(hidden) {
  document.documentElement.style.overflow = hidden ? 'hidden' : '';
}

async function captureFullPage(tabId, windowId) {
  const [{ result: metrics }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: getPageMetrics
  });

  await chrome.scripting.executeScript({ target: { tabId }, func: setScrollLock, args: [true] });

  const segments = [];
  const step = metrics.viewportHeight;
  let y = 0;
  const maxY = Math.max(metrics.scrollHeight - metrics.viewportHeight, 0);

  while (true) {
    const targetY = Math.min(y, maxY);
    await chrome.scripting.executeScript({ target: { tabId }, func: scrollPageTo, args: [0, targetY] });
    await sleep(CAPTURE_DELAY_MS);
    const dataUrl = await captureVisibleTabSafe(windowId);
    segments.push({ dataUrl, y: targetY });
    if (targetY >= maxY) break;
    y += step;
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (x, y2) => window.scrollTo(x, y2),
    args: [metrics.originalScrollX, metrics.originalScrollY]
  });
  await chrome.scripting.executeScript({ target: { tabId }, func: setScrollLock, args: [false] });

  // Determine device pixel scale from the first captured image.
  const firstBlob = await (await fetch(segments[0].dataUrl)).blob();
  const firstBitmap = await createImageBitmap(firstBlob);
  const scale = firstBitmap.width / metrics.viewportWidth;

  const canvasWidth = firstBitmap.width;
  const canvasHeight = Math.round(metrics.scrollHeight * scale);
  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  for (const seg of segments) {
    const blob = seg.dataUrl === segments[0].dataUrl ? firstBlob : await (await fetch(seg.dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    ctx.drawImage(bitmap, 0, Math.round(seg.y * scale));
    bitmap.close();
  }

  const jpgBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  await downloadBlobAsJpg(jpgBlob, 'screenshot-full');
  await showToast(tabId, chrome.i18n.getMessage('toastFullPageDone'));
}

/* ---------------- AREA SELECTION CAPTURE ---------------- */

async function startSelection(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

async function captureSelection(tab, rect, viewportWidth) {
  await sleep(60); // extra safety margin for the overlay-removal repaint
  const dataUrl = await captureVisibleTabSafe(tab.windowId);
  const blob = await (await fetch(dataUrl)).blob();
  const fullBitmap = await createImageBitmap(blob);
  const scale = fullBitmap.width / viewportWidth;

  const sx = Math.round(rect.x * scale);
  const sy = Math.round(rect.y * scale);
  const sw = Math.round(rect.width * scale);
  const sh = Math.round(rect.height * scale);

  const cropBitmap = await createImageBitmap(fullBitmap, sx, sy, sw, sh);
  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cropBitmap, 0, 0);

  const jpgBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  await downloadBlobAsJpg(jpgBlob, 'screenshot-area');
  await showToast(tab.id, chrome.i18n.getMessage('toastAreaDone'));
}

/* ---------------- MESSAGE ROUTER ---------------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CAPTURE_FULL_PAGE') {
    sendResponse({ ok: true });
    captureFullPage(msg.tabId, msg.windowId).catch((err) => {
      console.error('Full page capture failed:', err);
      showToast(msg.tabId, chrome.i18n.getMessage('toastError', [err.message]));
    });
  } else if (msg.type === 'START_SELECTION') {
    sendResponse({ ok: true });
    startSelection(msg.tabId).catch((err) => {
      console.error('Injecting selection UI failed:', err);
      showToast(msg.tabId, chrome.i18n.getMessage('toastError', [err.message]));
    });
  } else if (msg.type === 'SELECTION_DONE') {
    const tab = sender.tab;
    sendResponse({ ok: true });
    captureSelection(tab, msg.rect, msg.viewportWidth).catch((err) => {
      console.error('Selection capture failed:', err);
      showToast(tab.id, chrome.i18n.getMessage('toastError', [err.message]));
    });
  }
  return false;
});
