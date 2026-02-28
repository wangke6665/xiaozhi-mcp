#!/bin/bash
pkill -f xiaozhi-client 2>/dev/null
sleep 1
cd /usr/lib/node_modules/openclaw
nohup node /root/.openclaw/workspace/xiaozhi-client-optimized.js > /tmp/xiaozhi-optimized.log 2>&1 &
echo "启动中..."
sleep 3
tail -10 /tmp/xiaozhi-optimized.log
