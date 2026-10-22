#!/usr/bin/env bash
# Render mockup HTML files to PNG using the vendored Chromium runtime deps.
set -e
export LD_LIBRARY_PATH=/workspace/.libs/root/usr/lib/x86_64-linux-gnu:/workspace/.libs/root/lib/x86_64-linux-gnu
export FONTCONFIG_FILE=/workspace/.libs/fonts.conf
cd /workspace/tools/shots
node shot.mjs "$@"
