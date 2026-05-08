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

// Add download icon to format buttons
function makeFormatBtnWithIcon(res, ext, size, type, url, formatId) {
  const btn = makeFormatBtn(res, ext, size, type, url, formatId);
  btn.insertAdjacentHTML('beforeend', '<span class="dl-icon">⬇</span>');
  return btn;
}

// ── PARTICLE SYSTEM ───────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, stars = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); buildStars(); });

  function buildStars() {
    const count = Math.floor((W * H) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.2,
      o: Math.random() * 0.55 + 0.1,
      sp: Math.random() * 0.015 + 0.003,
      dir: Math.random() > .5 ? 1 : -1,
      vy: (Math.random() - 0.5) * 0.08,
      vx: (Math.random() - 0.5) * 0.05,
    }));
  }
  buildStars();

  function draw() {
    ctx.clearRect(0, 0, W, H);
    stars.forEach(s => {
      s.o += s.sp * s.dir;
      if (s.o > 0.65 || s.o < 0.05) s.dir *= -1;
      s.x = (s.x + s.vx + W) % W;
      s.y = (s.y + s.vy + H) % H;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167,139,250,${s.o.toFixed(2)})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();

  // Subtle mouse parallax
  window.addEventListener('mousemove', e => {
    const mx = (e.clientX / W - .5) * 0.4;
    const my = (e.clientY / H - .5) * 0.4;
    stars.forEach(s => {
      s.x += mx * s.r;
      s.y += my * s.r;
    });
  }, { passive: true });
})();

// ── 3D TILT on cards ─────────────────────────────────────────────
function enableTilt(el) {
  if (!el) return;
  const strength = 10;
  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  - .5) * 2;
    const y = ((e.clientY - r.top)  / r.height - .5) * 2;
    el.style.transform = `perspective(800px) rotateX(${-y * strength}deg) rotateY(${x * strength}deg) translateZ(8px)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateZ(0)';
    el.style.transition = 'transform .5s cubic-bezier(.23,1,.32,1)';
    setTimeout(() => { el.style.transition = ''; }, 500);
  });
}

// Attach tilt to video card whenever result is shown
const _origDisplay = displayResult;
displayResult = function(data, url) {
  _origDisplay(data, url);
  setTimeout(() => {
    const card = document.querySelector('.video-card');
    if (card) enableTilt(card);
    document.querySelectorAll('.format-btn').forEach(b => {
      b.insertAdjacentHTML('beforeend', '<span class="dl-icon">⬇</span>');
    });
  }, 100);
};

// ── SCROLL REVEAL ─────────────────────────────────────────────────
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => obs.observe(el));
}
initScrollReveal();

// ── COUNTER ANIMATION ─────────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    const target = +el.dataset.target;
    let cur = 0;
    const step = target / 60;
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = Math.floor(cur).toLocaleString() + (el.dataset.suffix || '');
      if (cur >= target) clearInterval(t);
    }, 18);
  });
}
animateCounters();
