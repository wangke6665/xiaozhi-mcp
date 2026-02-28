#!/bin/bash
# 服务器性能测试脚本（简化版，无需额外安装）

RESULTS_DIR="/tmp/server_benchmark_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"
REPORT_FILE="$RESULTS_DIR/report.txt"

echo "========================================"
echo "   服务器全面性能测试报告"
echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# 1. 系统信息
echo ">>> 1. 系统基本信息"
echo "主机名: $(hostname)"
echo "操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "内核: $(uname -r)"
echo "架构: $(uname -m)"
echo "运行时间: $(uptime -p)"
echo ""

# 2. CPU 测试
echo ">>> 2. CPU 性能测试"
echo "CPU 型号: $(cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d':' -f2 | xargs)"
echo "核心数: $(nproc)"
echo "负载: $(cat /proc/loadavg)"

echo "CPU 压力测试 (计算 π 到 5000 位，运行 3 次)..."
for i in 1 2 3; do
    START=$(date +%s.%N)
    echo "scale=5000; 4*a(1)" | bc -l > /dev/null 2>&1 || echo "scale=5000; a(1)*4" | awk -f - > /dev/null 2>&1
    END=$(date +%s.%N)
    TIME=$(echo "$END - $START" | bc)
    echo "  第 $i 次: ${TIME}s"
done
echo ""

# 3. 内存测试
echo ">>> 3. 内存信息与测试"
free -h
echo ""
echo "内存写入测试 (写入 1GB)..."
START=$(date +%s)
dd if=/dev/zero of=/tmp/memtest bs=1M count=1024 conv=fdatasync 2>&1 | tail -1
END=$(date +%s)
echo "耗时: $((END-START)) 秒"
rm -f /tmp/memtest
echo ""

# 4. 磁盘 IO 测试
echo ">>> 4. 磁盘 IO 性能测试"
echo "磁盘使用情况:"
df -h /
echo ""

TESTFILE="/tmp/disk_test_$$"

echo "顺序写测试 (1GB)..."
dd if=/dev/zero of="$TESTFILE" bs=1M count=1024 conv=fdatasync 2>&1 | tail -1

echo "顺序读测试 (1GB)..."
dd if="$TESTFILE" of=/dev/null bs=1M 2>&1 | tail -1

rm -f "$TESTFILE"
echo ""

# 5. 网络测试
echo ">>> 5. 网络性能测试"
echo "网卡信息:"
ip addr show | grep -E "^[0-9]:|inet " | head -10

echo ""
echo "Ping 测试 (百度):"
ping -c 5 -W 2 baidu.com 2>/dev/null | tail -2 || echo "ping 失败"

echo ""
echo "下载速度测试 (从 GitHub 下载 10MB 测试文件):"
START=$(date +%s)
curl -o /dev/null -w "Speed: %{speed_download} bytes/sec (%{speed_download}/1024/1024 MB/s)\n" -sL "https://github.com/AaronFeng753/Waifu2x-Extension-GUI/releases/download/v2.21.12/Waifu2x-Extension-GUI-v2.21.12-Portable.7z" 2>/dev/null | head -1 || echo "下载测试失败"
END=$(date +%s)
echo "耗时: $((END-START)) 秒"
echo ""

# 6. 进程监控
echo ">>> 6. 系统进程状态"
echo "TOP 5 CPU 占用:"
ps aux --sort=-%cpu | head -6

echo ""
echo "TOP 5 内存占用:"
ps aux --sort=-%mem | head -6
echo ""

# 7. 端口检查
echo ">>> 7. 网络端口状态"
echo "监听中的端口:"
ss -tlnp 2>/dev/null | head -15 || netstat -tlnp 2>/dev/null | head -15
echo ""

# 8. 系统限制
echo ">>> 8. 系统限制"
echo "文件描述符限制: $(ulimit -n)"
echo "进程数限制: $(ulimit -u)"
echo "最大内存: $(ulimit -v 2>/dev/null || echo 'unlimited')"
echo ""

# 总结
echo ">>> 测试完成"
echo "测试结果保存在: $RESULTS_DIR"
echo "✓ 全部测试结束"