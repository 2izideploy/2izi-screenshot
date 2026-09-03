(() => {
  // Avoid double-injection if user clicks the button twice quickly.
  if (window.__qsSelectionActive) return;
  window.__qsSelectionActive = true;

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.25)',
    cursor: 'crosshair',
    zIndex: 2147483647,
    userSelect: 'none'
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed',
    border: '1.5px solid #4da3ff',
    background: 'rgba(77,163,255,0.15)',
    display: 'none',
    zIndex: 2147483647,
    boxSizing: 'border-box'
  });

  const label = document.createElement('div');
  Object.assign(label.style, {
    position: 'fixed',
    background: 'rgba(20,20,20,0.85)',
    color: '#fff',
    font: '11px sans-serif',
    padding: '2px 6px',
    borderRadius: '4px',
    zIndex: 2147483647,
    display: 'none',
    pointerEvents: 'none'
  });

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(box);
  document.documentElement.appendChild(label);

  let startX = 0, startY = 0, dragging = false;

  function cleanup() {
    overlay.remove();
    box.remove();
    label.remove();
    document.removeEventListener('keydown', onKeyDown, true);
    window.__qsSelectionActive = false;
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
    }
  }

  function updateBox(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    Object.assign(box.style, {
      display: 'block',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`
    });
    Object.assign(label.style, {
      display: 'block',
      left: `${left}px`,
      top: `${Math.max(top - 20, 0)}px`
    });
    label.textContent = `${Math.round(width)} × ${Math.round(height)}`;
  }

  overlay.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    updateBox(startX, startY, startX, startY);
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    updateBox(startX, startY, e.clientX, e.clientY);
  });

  overlay.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;

    const rect = {
      x: Math.round(Math.min(startX, e.clientX)),
      y: Math.round(Math.min(startY, e.clientY)),
      width: Math.round(Math.abs(e.clientX - startX)),
      height: Math.round(Math.abs(e.clientY - startY))
    };

    cleanup();

    if (rect.width < 4 || rect.height < 4) return; // ignore accidental clicks

    // Overlay removal needs to actually paint before we let the background
    // script capture the tab, otherwise the dark tint still shows up in the shot.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chrome.runtime.sendMessage({
          type: 'SELECTION_DONE',
          rect,
          viewportWidth: window.innerWidth
        });
      });
    });
  });

  document.addEventListener('keydown', onKeyDown, true);
})();
