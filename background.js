// Full Page Capture - background service worker
// Semua proses (scroll, screenshot, stitching) terjadi di dalam browser pengguna.
// Tidak ada request keluar ke server pihak ketiga.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_CAPTURE') {
    captureFullPage(msg.tabId)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep the message channel open for async response
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// chrome.tabs.captureVisibleTab dibatasi ~2 panggilan/detik oleh Chrome.
// Kalau kena limit, tunggu lalu coba lagi (dengan backoff).
async function captureVisibleTabWithRetry(maxRetries = 5) {
  let delay = 600;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
    } catch (err) {
      const isQuotaError = err.message && err.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND');
      if (!isQuotaError || attempt === maxRetries) {
        throw err;
      }
      await sleep(delay);
      delay = Math.min(delay * 1.5, 3000);
    }
  }
}

async function getPageMetrics(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const body = document.body;
      const html = document.documentElement;
      const totalHeight = Math.max(
        body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight
      );
      const totalWidth = Math.max(
        body.scrollWidth, body.offsetWidth,
        html.clientWidth, html.scrollWidth, html.offsetWidth
      );
      return {
        totalHeight,
        totalWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        dpr: window.devicePixelRatio || 1,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      };
    }
  });
  return result;
}

async function scrollTo(tabId, x, y) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (x, y) => {
      window.scrollTo(x, y);
      return {
        scrollY: window.scrollY,
        scrollX: window.scrollX,
        // recompute in case lazy-loaded content changed page height
        totalHeight: Math.max(
          document.body.scrollHeight, document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        )
      };
    },
    args: [x, y]
  });
  return result; // { scrollY, scrollX, totalHeight } -- posisi & tinggi aktual setelah scroll
}

async function hideFixedElements(tabId) {
  // Sembunyikan elemen fixed/sticky (misal header/nav) agar tidak terduplikasi di tiap segmen
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const styleTag = document.createElement('style');
      styleTag.id = '__fpc_hide_fixed__';
      let css = '';
      document.querySelectorAll('body *').forEach((el) => {
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'sticky') {
          el.setAttribute('data-fpc-hidden', '1');
        }
      });
      css = '[data-fpc-hidden="1"] { visibility: hidden !important; }';
      styleTag.textContent = css;
      document.head.appendChild(styleTag);
    }
  });
}

async function restoreFixedElements(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      document.querySelectorAll('[data-fpc-hidden="1"]').forEach((el) => {
        el.removeAttribute('data-fpc-hidden');
      });
      const styleTag = document.getElementById('__fpc_hide_fixed__');
      if (styleTag) styleTag.remove();
    }
  });
}

async function captureFullPage(tabId, mode) {
  const metrics = await getPageMetrics(tabId);
  const { viewportHeight, viewportWidth, dpr } = metrics;

  const segments = [];
  let lastScrollY = -1;
  let y = 0;
  const maxSegments = 60; // safety cap biar tidak infinite loop di halaman yang aneh

  await hideFixedElements(tabId);

  try {
    for (let i = 0; i < maxSegments; i++) {
      const { scrollY, totalHeight } = await scrollTo(tabId, 0, y);

      // Kalau posisi scroll tidak berubah dari capture sebelumnya, berarti
      // sudah mentok di paling bawah (atau halaman lebih pendek dari 1 viewport).
      if (scrollY === lastScrollY) break;

      await sleep(300); // beri waktu render/lazy-load setelah scroll benar-benar berpindah
      const dataUrl = await captureVisibleTabWithRetry();
      segments.push({ dataUrl, y: scrollY });

      lastScrollY = scrollY;

      // Kalau sudah mentok di bawah (scrollY + viewport >= totalHeight), berhenti setelah capture ini
      if (scrollY + viewportHeight >= totalHeight) break;

      y = scrollY + viewportHeight;
      await sleep(600); // jaga jarak antar capture, hindari rate limit Chrome (~2/detik)
    }
  } finally {
    await restoreFixedElements(tabId);
    await scrollTo(tabId, metrics.scrollX, metrics.scrollY); // kembalikan posisi semula
  }

  // totalHeight final = posisi capture terakhir + tinggi viewport (real, bukan estimasi awal)
  const lastSeg = segments[segments.length - 1];
  const finalTotalHeight = lastSeg ? lastSeg.y + viewportHeight : metrics.totalHeight;

  const stitchedDataUrl = await stitchImages(segments, {
    totalHeight: finalTotalHeight,
    viewportHeight,
    viewportWidth,
    dpr
  });

  if (mode === 'download') {
    const filename = `fullpage-capture-${Date.now()}.png`;
    await chrome.downloads.download({
      url: stitchedDataUrl,
      filename,
      saveAs: false
    });
    return { mode: 'download' };
  }

  // Simpan hasil capture ke storage lokal, lalu buka tab baru berisi preview
  // dengan tombol "Copy to Clipboard" dan "Download".
  await chrome.storage.local.set({ latestCapture: stitchedDataUrl });
  await chrome.tabs.create({ url: chrome.runtime.getURL('result.html') });

  return { mode: 'result-tab' };
}

// Stitching dilakukan via OffscreenCanvas di dalam service worker
async function stitchImages(segments, { totalHeight, viewportHeight, viewportWidth, dpr }) {
  const canvasHeight = Math.round(totalHeight * dpr);
  const canvasWidth = Math.round(viewportWidth * dpr);

  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  for (const seg of segments) {
    const blob = await (await fetch(seg.dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const destY = Math.round(seg.y * dpr);
    ctx.drawImage(bitmap, 0, destY);
  }

  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  return await blobToDataUrl(outBlob);
}

function blobToDataUrl(blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunks = [];
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
    }

    return `data:${blob.type};base64,${btoa(chunks.join(''))}`;
  });
}
