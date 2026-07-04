#!/bin/bash
set -e

# Virtual display + VNC so the headed apply-assist Chromium is viewable at
# http://localhost:6080/vnc.html while the app itself runs on :3001.
Xvfb :99 -screen 0 1360x1020x24 >/tmp/xvfb.log 2>&1 &
sleep 1
x11vnc -display :99 -nopw -forever -shared -bg -quiet >/tmp/x11vnc.log 2>&1 || true
websockify --web=/usr/share/novnc 6080 localhost:5900 >/tmp/novnc.log 2>&1 &

exec node server/src/index.js
