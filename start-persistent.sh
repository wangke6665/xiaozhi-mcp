#!/bin/bash
pkill -f xiaozhi-client 2>/dev/null
sleep 1
cd /usr/lib/node_modules/openclaw
nohup node /root/.openclaw/workspace/xiaozhi-client-persistent.js > /tmp/xiaozhi-persistent.log 2>&1 &
echo "服务已启动，PID: $!"
sleep 2
tail -10 /tmp/xiaozhi-persistent.log
