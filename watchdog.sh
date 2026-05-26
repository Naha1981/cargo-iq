#!/bin/bash
while true; do
  echo "[$(date)] Starting server..." >> /tmp/watchdog.log
  cd /home/z/my-project
  node node_modules/.bin/next dev -p 3000 --webpack >> /tmp/next-watchdog.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE" >> /tmp/watchdog.log
  sleep 3
done
