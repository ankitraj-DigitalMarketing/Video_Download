const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG_DIR = 'C:\\Users\\mayur\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const BASE_ARGS = [
  '--no-check-certificates',
  '--no-warnings',
  '--no-playlist',
  '--ffmpeg-location', FFMPEG_DIR,
];

function isValidUrl(str) {
  try {
    const u = new URL(str.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

function runYtDlp(args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, args, { windowsHide: true });
    let out = '', err = '';
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', d => { err += d; });
    const t = setTimeout(() => { proc.kill(); reject(new Error('Timeout')); }, timeoutMs);
    proc.on('close', code => {
      clearTimeout(t);
      code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`));
    });
  });
}

// ─── INFO ────────────────────────────────────────────────────────────────────
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url || !isValidUrl(url)) return res.status(400).json({ error: 'Sahi URL daalen' });

  try {
    const out = await runYtDlp([...BASE_ARGS, '--dump-json', url.trim()], 35000);
    const info = JSON.parse(out.trim());

    const seen = new Set();
    const formats = (info.formats || [])
      .filter(f => f.url)
      .map(f => ({
        format_id: f.format_id,
        ext: f.ext,
        resolution: f.resolution || (f.height ? `${f.height}p` : 'Audio'),
        filesize: f.filesize || f.filesize_approx || null,
        vcodec: f.vcodec,
        acodec: f.acodec,
        needsMerge: f.vcodec !== 'none' && f.acodec === 'none',
      }))
      .filter(f => {
        const key = `${f.resolution}-${f.ext}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0))
      .slice(0, 12);

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      uploader: info.uploader || info.channel,
      platform: info.extractor_key,
      formats,
    });
  } catch (err) {
    const m = err.message || '';
    if (m.includes('login') || m.includes('Sign in')) return res.status(400).json({ error: 'Yeh video private hai — login required' });
    if (m.includes('unavailable') || m.includes('not available')) return res.status(400).json({ error: 'Video available nahi hai' });
    if (m.includes('Timeout')) return res.status(408).json({ error: 'Server slow hai, dobara try karein' });
    res.status(400).json({ error: 'Video nahi mila. URL check karein.' });
  }
});

// ─── DOWNLOAD (direct pipe — no temp file, fast) ──────────────────────────────
app.get('/api/download', async (req, res) => {
  const { url, format_id } = req.query;
  if (!url || !isValidUrl(url)) return res.status(400).send('Invalid URL');

  const fmt = format_id || 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
  const needsMerge = fmt.includes('+');
  const outExt = needsMerge ? 'mkv' : '%(ext)s';

  // Get filename first (quick)
  let filename = 'video.mp4';
  try {
    const fn = await runYtDlp([
      ...BASE_ARGS, '--print', 'filename', '--skip-download',
      '-f', fmt, '-o', `%(title)s.${outExt}`, url.trim()
    ], 20000);
    filename = fn.trim().split('\n').pop().trim() || filename;
  } catch {}

  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Content-Type', 'application/octet-stream');

  const args = [
    ...BASE_ARGS,
    '-f', fmt,
    '-o', '-',
    ...(needsMerge ? ['--merge-output-format', 'mkv'] : []),
    url.trim()
  ];

  const proc = spawn(YTDLP, args, { windowsHide: true });
  proc.stdout.pipe(res);

  let errBuf = '';
  proc.stderr.on('data', d => { errBuf += d; });
  proc.on('error', () => { if (!res.headersSent) res.status(500).send('Error'); });
  proc.on('close', code => { if (code !== 0 && !res.headersSent) res.status(500).send(errBuf); });
  req.on('close', () => proc.kill());
});

app.listen(PORT, () => {
  console.log(`\nServer: http://localhost:${PORT}`);
  runYtDlp(['--version']).then(v => console.log(`yt-dlp ${v.trim()} ready`)).catch(() => console.error('yt-dlp not found'));
  const ff = spawn(path.join(FFMPEG_DIR, 'ffmpeg.exe'), ['-version'], { windowsHide: true });
  ff.stdout.once('data', d => console.log('ffmpeg ready:', d.toString().split('\n')[0]));
});
