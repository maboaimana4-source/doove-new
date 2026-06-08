#!/usr/bin/env bash
# Download FFmpeg + FFprobe for Linux x64 and place them as Tauri sidecars.
#
# johnvansickle.com ships a static glibc-compatible build that works on
# every distro we target (Ubuntu 22.04+, Fedora 36+, Debian 12+).
#
# Inputs:
#   $1 — Rust target triple (e.g. x86_64-unknown-linux-gnu)
#   $2 — destination directory for sidecars

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

triple="${1:?Rust target triple required as arg 1}"
dest="${2:?Destination directory required as arg 2}"

mkdir -p "$dest"
curl -L "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-x64" -o "$dest/ffmpeg-$triple"
curl -L "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffprobe-linux-x64" -o "$dest/ffprobe-$triple"
chmod +x "$dest/ffmpeg-$triple" "$dest/ffprobe-$triple"
