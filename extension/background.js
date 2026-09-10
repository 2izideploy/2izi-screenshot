const EXTENSION_BUILD = 'build-18-warmup-remeasure';
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


// Neutralizes every fixed/sticky element on the page for the duration of
// the full-page capture (nav headers, search toolbars, bottom action
// bars — whatever). Sticky/fixed elements are what cause duplication when
// scrolling and stitching segments together: they redraw themselves at
// the same viewport position on every single segment. Once none of them
// are actually "stuck", each segment just shows whatever is in normal
// document flow at that scroll position, so nothing can be captured
// twice — regardless of how many such bars a page has or at what scroll
// depth each one activates. This replaces a much more fragile earlier
// approach that tried to detect/classify/hide them individually and
// paste a "clean" copy back in afterwards.
//
// Note on layout safety: `position: sticky` elements are never removed
// from normal document flow (only `fixed` ones are), so forcing sticky
// elements to `static` cannot change the page's scrollHeight or shift
// other content — it only stops them from re-pinning to the viewport.
//
// IMPORTANT: chrome.scripting.executeScript only injects the exact
// function passed as `func` — it does not bring along other top-level
// functions from this file via closure, so this logic is self-contained.
function disableStickyPositioning() {
  const vh = window.innerHeight;
  let count = 0;
  try {
    const all = document.querySelectorAll('body *');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      try {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
        const r = el.getBoundingClientRect();
        // Skip genuinely tiny floating widgets (small badges, single
        // icon buttons) but otherwise catch anything reasonably sized —
        // including narrow sticky sidebars, not just wide top/bottom
        // bars. Also skip near-full-screen overlays (open modals) since
        // forcing those to static could scramble an intentional overlay
        // rather than a page chrome element.
        if (r.width < 60 || r.height < 20) continue;
        // Skip probable full-screen modal overlays (wide AND tall), but
        // let tall, narrow sticky sidebars through — those are exactly
        // the kind of element we need to neutralize.
        if (r.width > window.innerWidth * 0.5 && r.height > vh * 0.85) continue;
        // Only record the true original position the first time we see
        // this element — if this function runs again on a later segment
        // (some sites reassert their own positioning via a scroll
        // listener, which is exactly why we call this every segment),
        // we must not overwrite the real original with whatever the
        // site's script had just set it back to.
        if (!el.hasAttribute('data-qs-orig-position')) {
          el.setAttribute('data-qs-orig-position', el.style.position || '');
        }
        el.style.setProperty('position', 'static', 'important');
        count++;
      } catch (e) { /* skip this element */ }
    }
    console.log('[2izi Screenshot] neutralized sticky/fixed elements:', count);
  } catch (err) {
    console.warn('[2izi Screenshot] disableStickyPositioning failed:', err);
  }
  return count;
}

function restoreStickyPositioning() {
  try {
    const all = document.querySelectorAll('[data-qs-orig-position]');
    all.forEach((el) => {
      try {
        const orig = el.getAttribute('data-qs-orig-position');
        if (orig) {
          el.style.position = orig;
        } else {
          el.style.removeProperty('position');
        }
        el.removeAttribute('data-qs-orig-position');
      } catch (e) { /* skip this element */ }
    });
  } catch (err) {
    console.warn('[2izi Screenshot] restoreStickyPositioning failed:', err);
  }
}



async function captureFullPage(tabId, windowId) {
  let [{ result: metrics }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: getPageMetrics
  });

  await chrome.scripting.executeScript({ target: { tabId }, func: setScrollLock, args: [true] });

  // Warm-up pass: some pages lazy-load content (images, infinite-scroll
  // product lists, footers that only mount once earlier sections finish
  // loading) as the user scrolls. Scroll all the way to the bottom once,
  // without capturing anything, so that content has a chance to load —
  // otherwise the page height measured at the very start is stale, and
  // the real capture loop below would stop (and size its final canvas)
  // too short, cutting off whatever loaded afterward.
  {
    const warmupStep = metrics.viewportHeight;
    const warmupMaxY = Math.max(metrics.scrollHeight - metrics.viewportHeight, 0);
    let wy = 0;
    while (wy < warmupMaxY) {
      wy = Math.min(wy + warmupStep, warmupMaxY);
      await chrome.scripting.executeScript({ target: { tabId }, func: scrollPageTo, args: [0, wy] });
      await sleep(220);
    }
    // Re-measure now that any lazy content has had a chance to load.
    [{ result: metrics }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: getPageMetrics
    });
    await chrome.scripting.executeScript({ target: { tabId }, func: scrollPageTo, args: [0, 0] });
    await sleep(120);
  }

  const segments = [];
  const step = metrics.viewportHeight;
  const maxY = Math.max(metrics.scrollHeight - metrics.viewportHeight, 0);
  let y = 0;

  while (true) {
    const targetY = Math.min(y, maxY);
    await chrome.scripting.executeScript({ target: { tabId }, func: scrollPageTo, args: [0, targetY] });
    await sleep(CAPTURE_DELAY_MS);

    // Re-apply on every single segment, not just once before the loop.
    // Some sites (jQuery-plugin sticky sidebars, scroll-event handlers,
    // etc.) reassert their own inline positioning in response to the
    // scroll event we just triggered, silently undoing a one-time
    // override. Doing this every step guards against that.
    try {
      await chrome.scripting.executeScript({ target: { tabId }, func: disableStickyPositioning });
    } catch (err) {
      console.error('Disabling sticky positioning failed for this segment, continuing anyway:', err);
    }

    const dataUrl = await captureVisibleTabSafe(windowId);
    segments.push({ dataUrl, y: targetY });
    if (targetY >= maxY) break;
    y += step;
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: restoreStickyPositioning });
  } catch (err) {
    console.error('Restoring sticky positioning failed:', err);
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (x, y2) => window.scrollTo(x, y2),
    args: [metrics.originalScrollX, metrics.originalScrollY]
  });
  await chrome.scripting.executeScript({ target: { tabId }, func: setScrollLock, args: [false] });

  // Determine device pixel scale from the first captured image, then
  // stitch all segments directly — no header/footer overlay needed since
  // nothing was sticky during capture, so nothing could duplicate.
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
