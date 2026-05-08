function formatDuration(s) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function formatSize(b) {
  if (!b) return '';
  if (b > 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b > 1048576) return (b / 1048576).toFixed(0) + ' MB';
  return (b / 1024).toFixed(0) + ' KB';
}

function showLoading(text) {
  document.getElementById('loadingText').textContent = text || 'Please wait...';
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

function showError(msg) {
  document.getElementById('errorMsg').textContent = msg;
  document.getElementById('errorBox').classList.remove('hidden');
  setTimeout(closeError, 6000);
}

function closeError() {
  document.getElementById('errorBox').classList.add('hidden');
}

async function fetchVideoInfo() {
  const url = document.getElementById('videoUrl').value.trim();
  if (!url) { showError('Pehle video ka link daalen!'); return; }

  const btn = document.getElementById('fetchBtn');
  btn.disabled = true;
  document.getElementById('resultSection').classList.add('hidden');
  showLoading('Video info fetch ho rahi hai...');

  try {
    const res = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    hideLoading();
    if (!res.ok) { showError(data.error || 'Kuch galat ho gaya.'); return; }
    displayResult(data, url);
  } catch {
    hideLoading();
    showError('Server se connect nahi ho saka.');
  } finally {
    btn.disabled = false;
  }
}

function displayResult(data, url) {
  document.getElementById('videoTitle').textContent = data.title || 'Unknown';
  document.getElementById('videoUploader').textContent = data.uploader ? `Channel: ${data.uploader}` : '';
  document.getElementById('videoPlatform').textContent = data.platform ? `Platform: ${data.platform}` : '';

  const thumb = document.getElementById('videoThumbnail');
  thumb.src = data.thumbnail || '';
  thumb.style.display = data.thumbnail ? 'block' : 'none';

  document.getElementById('videoDuration').textContent = formatDuration(data.duration);

  const grid = document.getElementById('formatsGrid');
  grid.innerHTML = '';

  // Best quality button always first
  const bestBtn = makeFormatBtn('Best Quality', 'auto', '', 'Sabse Best', url, 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
  bestBtn.style.borderColor = 'var(--primary)';
  bestBtn.querySelector('.fmt-res').style.color = 'var(--accent)';
  grid.appendChild(bestBtn);

  if (data.formats && data.formats.length > 0) {
    data.formats.forEach(fmt => {
      const isAudio = fmt.vcodec === 'none';
      const label = isAudio ? 'Audio Only' : (fmt.needsMerge ? 'Video (merge)' : 'Video + Audio');
      grid.appendChild(makeFormatBtn(
        fmt.resolution || 'Auto',
        '.' + fmt.ext,
        fmt.filesize ? formatSize(fmt.filesize) : '',
        label,
        url,
        fmt.format_id
      ));
    });
  }

  document.getElementById('resultSection').classList.remove('hidden');
  document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function makeFormatBtn(res, ext, size, type, url, formatId) {
  const btn = document.createElement('button');
  btn.className = 'format-btn';
  btn.innerHTML = `
    <span class="fmt-res">${res}</span>
    <span class="fmt-ext">${ext}</span>
    ${size ? `<span class="fmt-size">${size}</span>` : ''}
    <span class="fmt-type">${type}</span>
  `;
  btn.onclick = () => downloadVideo(url, formatId);
  return btn;
}

function downloadVideo(url, formatId) {
  // GET endpoint — browser handles download natively with progress bar
  const params = new URLSearchParams({ url, format_id: formatId });
  const a = document.createElement('a');
  a.href = '/api/download?' + params.toString();
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

document.getElementById('videoUrl').addEventListener('keypress', e => {
  if (e.key === 'Enter') fetchVideoInfo();
});

document.getElementById('videoUrl').addEventListener('paste', () => {
  setTimeout(() => {
    const val = document.getElementById('videoUrl').value.trim();
    if (val.startsWith('http')) fetchVideoInfo();
  }, 100);
});
