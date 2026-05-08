# Local development startup script
$env:YTDLP_PATH  = "C:\Users\mayur\yt-dlp.exe"
$env:FFMPEG_PATH = "C:\Users\mayur\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"

Write-Host "Starting VideoSave Pro..." -ForegroundColor Cyan
node server.js
