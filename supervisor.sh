#!/bin/bash
while true; do
  echo "[$(date)] Starting Next.js production server..." >> /tmp/supervisor.log
  cd /home/z/my-project
  node node_modules/.bin/next start -p 3000 >> /tmp/supervisor.log 2>&1
  EXIT=$?
  echo "[$(date)] Server exited with code $EXIT, restarting in 3s..." >> /tmp/supervisor.log
  sleep 3
done
