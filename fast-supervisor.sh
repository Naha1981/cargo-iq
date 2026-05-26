#!/bin/bash
while true; do
  cd /home/z/my-project
  node node_modules/.bin/next start -p 3000 &
  SERVER_PID=$!
  # Wait for the server to die
  wait $SERVER_PID 2>/dev/null
  sleep 1
done
