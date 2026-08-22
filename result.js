const loadingEl = document.getElementById('loading');
const imgEl = document.getElementById('resultImg');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusMsg = document.getElementById('statusMsg');

let currentDataUrl = null;

function setStatus(text, isError = false) {
  statusMsg.textContent = text;
  statusMsg.classList.toggle('error', isError);
}

async function loadCapture() {
  const { latestCapture } = await chrome.storage.local.get('latestCapture');
  if (!latestCapture) {
    loadingEl.textContent = 'Tidak ada hasil capture yang ditemukan. Coba capture ulang dari popup extension.';
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
    return;
  }
  currentDataUrl = latestCapture;
  imgEl.src = latestCapture;
  imgEl.onload = () => {
    loadingEl.style.display = 'none';
    imgEl.style.display = 'block';
  };
}

copyBtn.addEventListener('click', async () => {
  if (!currentDataUrl) return;
  copyBtn.disabled = true;
  setStatus('Menyalin...');
  try {
    const res = await fetch(currentDataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ]);
    setStatus('✅ Tersalin ke clipboard!');
  } catch (e) {
    setStatus('Gagal copy: ' + e.message, true);
  }
  copyBtn.disabled = false;
});

downloadBtn.addEventListener('click', () => {
  if (!currentDataUrl) return;
  const a = document.createElement('a');
  a.href = currentDataUrl;
  a.download = `fullpage-capture-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setStatus('✅ Download dimulai.');
});

loadCapture();
