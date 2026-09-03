function localize() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.textContent = msg;
  });
}
localize();

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

document.getElementById('full').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  try {
    await chrome.runtime.sendMessage({ type: 'CAPTURE_FULL_PAGE', tabId: tab.id, windowId: tab.windowId });
  } catch (e) {
    console.error('sendMessage failed', e);
  }
  window.close();
});

document.getElementById('area').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  try {
    await chrome.runtime.sendMessage({ type: 'START_SELECTION', tabId: tab.id, windowId: tab.windowId });
  } catch (e) {
    console.error('sendMessage failed', e);
  }
  window.close();
});
