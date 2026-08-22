const captureBtn = document.getElementById('captureBtn');
const status = document.getElementById('status');

captureBtn.addEventListener('click', async () => {
  captureBtn.disabled = true;
  status.textContent = 'Memulai capture...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    status.textContent = 'Tidak ada tab aktif.';
    captureBtn.disabled = false;
    return;
  }

  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
    status.textContent = 'Tidak bisa capture halaman internal browser.';
    captureBtn.disabled = false;
    return;
  }

  chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id }, (response) => {
    captureBtn.disabled = false;

    if (chrome.runtime.lastError) {
      status.textContent = 'Error: ' + chrome.runtime.lastError.message;
      return;
    }
    if (!response || !response.ok) {
      status.textContent = 'Gagal: ' + (response && response.error ? response.error : 'unknown error');
      return;
    }

    status.textContent = '✅ Selesai! Cek tab baru yang terbuka.';
  });
});
