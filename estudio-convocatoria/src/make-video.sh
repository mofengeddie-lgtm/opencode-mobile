#!/usr/bin/env bash
# Une las imágenes de build/frames en ../08-video-repaso.mp4 (1080p, pista de audio silenciosa).
set -euo pipefail
cd "$(dirname "$0")/build/frames"
ffmpeg -hide_banner -loglevel error -y \
  -f concat -safe 0 -i list.txt \
  -f lavfi -i anullsrc=r=44100:cl=stereo \
  -vf "fps=24,format=yuv420p" \
  -c:v libx264 -preset medium -crf 22 -tune stillimage \
  -c:a aac -b:a 64k -shortest -movflags +faststart \
  ../../../08-video-repaso.mp4
echo "[video] $(cd ../../.. && pwd)/08-video-repaso.mp4"
