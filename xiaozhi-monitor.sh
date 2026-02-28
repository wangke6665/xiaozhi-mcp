#!/bin/bash
# 小欧 MCP 客户端监控脚本 - 自动保活

LOG_FILE="/tmp/xiaozhi-monitor.log"
PID_FILE="/tmp/xiaozhi-mcp.pid"
SERVICE_SCRIPT="/root/.openclaw/workspace/xiaozhi-mcp.service"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log() {
  echo "[$(timestamp)] $1" >> "$LOG_FILE"
}

# 检查进程是否存在
check_process() {
  if [ -f "$PID_FILE" ]; then
    local pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0  # 进程存在
    fi
  fi
  return 1  # 进程不存在
}

# 检查 WebSocket 连接是否正常
check_connection() {
  # 检查最近日志中是否有连接成功的记录
  if [ -f "/tmp/xiaozhi-mcp.log" ]; then
    # 检查最近1分钟内是否有活动
    local recent_activity=$(tail -20 /tmp/xiaozhi-mcp.log 2>/dev/null | grep -c "已连接到小智")
    if [ "$recent_activity" -gt 0 ]; then
      return 0  # 连接正常
    fi
  fi
  return 1
}

# 主逻辑
main() {
  log "=== 开始监控检查 ==="
  
  if check_process; then
    log "✅ 进程运行正常 (PID: $(cat $PID_FILE))"
    
    # 额外检查连接状态
    if ! check_connection; then
      log "⚠️ 进程存在但可能未连接，尝试重启..."
      bash "$SERVICE_SCRIPT" stop >> "$LOG_FILE" 2>&1
      sleep 2
      bash "$SERVICE_SCRIPT" start >> "$LOG_FILE" 2>&1
      log "🔄 已重启服务"
    else
      log "✅ 连接状态正常"
    fi
  else
    log "🔴 进程不存在，启动服务..."
    bash "$SERVICE_SCRIPT" start >> "$LOG_FILE" 2>&1
    log "🚀 服务已启动"
  fi
  
  log "=== 监控检查完成 ==="
}

# 执行
main
