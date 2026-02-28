#!/bin/bash
# 服务器全面性能测试脚本
# 测试项目：CPU、内存、磁盘IO、网络、系统信息

set -e

RESULTS_DIR="/tmp/server_benchmark_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"
REPORT_FILE="$RESULTS_DIR/report.txt"

echo "========================================" | tee -a "$REPORT_FILE"
echo "   服务器全面性能测试报告" | tee -a "$REPORT_FILE"
echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$REPORT_FILE"
echo "========================================" | tee -a "$REPORT_FILE"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_section() {
    echo -e "\n${YELLOW}>>> $1${NC}" | tee -a "$REPORT_FILE"
    echo "----------------------------------------" | tee -a "$REPORT_FILE"
}

# 1. 系统基本信息
print_section "1. 系统基本信息"
{
    echo "主机名: $(hostname)"
    echo "操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
    echo "内核版本: $(uname -r)"
    echo "架构: $(uname -m)"
    echo "运行时间: $(uptime -p)"
    echo "当前时间: $(date)"
} | tee -a "$REPORT_FILE"

# 2. CPU 信息
print_section "2. CPU 详细信息"
{
    echo "CPU 型号: $(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)"
    echo "CPU 核心数: $(nproc)"
    echo "CPU 线程数: $(lscpu | grep '^CPU(s):' | awk '{print $2}')"
    echo "CPU 频率: $(lscpu | grep 'CPU max MHz' | awk '{print $4}' | head -1) MHz"
    echo "CPU 负载: $(cat /proc/loadavg | awk '{print $1", "$2", "$3}')"
    echo "CPU 缓存:"
    lscpu | grep -E "L[123]d? cache" | sed 's/^/  /'
} | tee -a "$REPORT_FILE"

# 3. CPU 性能测试
print_section "3. CPU 性能测试 (sysbench)"
if command -v sysbench &> /dev/null; then
    echo "正在进行 CPU 素数计算测试..."
    sysbench cpu --cpu-max-prime=20000 --threads=$(nproc) run | tee "$RESULTS_DIR/cpu_test.txt" | grep -E "total time|min:|avg:|max:" | tee -a "$REPORT_FILE"
else
    echo "安装 sysbench..."
    apt-get update -qq && apt-get install -y -qq sysbench > /dev/null 2>&1
    echo "正在进行 CPU 素数计算测试..."
    sysbench cpu --cpu-max-prime=20000 --threads=$(nproc) run | tee "$RESULTS_DIR/cpu_test.txt" | grep -E "total time|min:|avg:|max:" | tee -a "$REPORT_FILE"
fi

# 4. 内存信息
print_section "4. 内存详细信息"
{
    free -h | tee -a "$REPORT_FILE"
    echo ""
    echo "内存速度: $(dmidecode -t memory 2>/dev/null | grep -i speed | head -1 | xargs || echo '无法获取')"
} | tee -a "$REPORT_FILE"

# 5. 内存性能测试
print_section "5. 内存性能测试"
if command -v sysbench &> /dev/null; then
    echo "正在进行内存读写测试..."
    sysbench memory --memory-block-size=1K --memory-total-size=10G --memory-oper=read run | tee "$RESULTS_DIR/memory_read.txt" | grep -E "Operations performed|transferred|total time" | tee -a "$REPORT_FILE"
    sysbench memory --memory-block-size=1K --memory-total-size=10G --memory-oper=write run | tee "$RESULTS_DIR/memory_write.txt" | grep -E "Operations performed|transferred|total time" | tee -a "$REPORT_FILE"
fi

# 6. 磁盘信息
print_section "6. 磁盘信息"
{
    df -h | grep -E "Filesystem|/dev/" | tee -a "$REPORT_FILE"
    echo ""
    echo "磁盘类型: $(lsblk -d -o NAME,ROTA,TYPE,SIZE,MODEL | grep -v loop | head -5)"
} | tee -a "$REPORT_FILE"

# 7. 磁盘 IO 性能测试
print_section "7. 磁盘 IO 性能测试 (fio)"
TEST_FILE="$RESULTS_DIR/fio_test.tmp"

# 顺序读测试
echo "顺序读测试 (4MB block)..."
dd if=/dev/zero of="$TEST_FILE" bs=1M count=1024 conv=fdatasync 2>&1 | tail -1 | tee -a "$REPORT_FILE"

echo "顺序写测试 (4MB block)..."
dd if="$TEST_FILE" of=/dev/null bs=1M 2>&1 | tail -1 | tee -a "$REPORT_FILE"

rm -f "$TEST_FILE"

# 使用 fio 进行更详细的测试（如果已安装）
if command -v fio &> /dev/null; then
    echo "详细 IO 测试 (fio)..."
    fio --name=randread --ioengine=libaio --iodepth=32 --rw=randread --bs=4k --direct=1 --size=512M --numjobs=4 --runtime=30 --group_reporting | tee "$RESULTS_DIR/fio_randread.txt" | grep -E "read:|IOPS|BW" | tee -a "$REPORT_FILE"
    fio --name=randwrite --ioengine=libaio --iodepth=32 --rw=randwrite --bs=4k --direct=1 --size=512M --numjobs=4 --runtime=30 --group_reporting | tee "$RESULTS_DIR/fio_randwrite.txt" | grep -E "write:|IOPS|BW" | tee -a "$REPORT_FILE"
fi

# 8. 网络性能测试
print_section "8. 网络性能测试"
{
    echo "网卡信息:"
    ip addr show | grep -E "^[0-9]|inet " | head -10 | tee -a "$REPORT_FILE"
    
    echo ""
    echo "网络连接测试 (ping 国内):"
    ping -c 5 -W 2 baidu.com 2>/dev/null | tail -2 | tee -a "$REPORT_FILE" || echo "百度 ping 失败"
    
    echo ""
    echo "网络连接测试 (ping 国际):"
    ping -c 5 -W 2 8.8.8.8 2>/dev/null | tail -2 | tee -a "$REPORT_FILE" || echo "Google DNS ping 失败"
    
    echo ""
    echo "下载速度测试 (Speedtest):"
    if command -v speedtest-cli &> /dev/null; then
        speedtest-cli --simple 2>/dev/null | tee -a "$REPORT_FILE" || echo "Speedtest 失败"
    else
        echo "正在安装 speedtest-cli..."
        apt-get install -y -qq speedtest-cli 2>/dev/null
        speedtest-cli --simple 2>/dev/null | tee -a "$REPORT_FILE" || echo "Speedtest 失败"
    fi
} | tee -a "$REPORT_FILE"

# 9. 进程和端口
print_section "9. 活跃进程和端口"
{
    echo "TOP 10 CPU 占用进程:"
    ps aux --sort=-%cpu | head -11 | tee -a "$REPORT_FILE"
    
    echo ""
    echo "TOP 10 内存占用进程:"
    ps aux --sort=-%mem | head -11 | tee -a "$REPORT_FILE"
    
    echo ""
    echo "监听端口:"
    ss -tlnp | head -20 | tee -a "$REPORT_FILE"
} | tee -a "$REPORT_FILE"

# 10. 安全审计
print_section "10. 基础安全检查"
{
    echo "开放端口数: $(ss -tln | wc -l)"
    echo "当前登录用户数: $(who | wc -l)"
    echo "最近登录记录:"
    last -n 5 2>/dev/null | tee -a "$REPORT_FILE" || echo "无记录"
    
    echo ""
    echo "防火墙状态:"
    ufw status 2>/dev/null | head -5 | tee -a "$REPORT_FILE" || iptables -L -n 2>/dev/null | head -10 | tee -a "$REPORT_FILE" || echo "未检测到防火墙"
} | tee -a "$REPORT_FILE"

# 生成总结
print_section "测试完成总结"
{
    echo "所有测试结果保存在: $RESULTS_DIR"
    echo "详细报告: $REPORT_FILE"
    echo ""
    echo "文件列表:"
    ls -lh "$RESULTS_DIR" | tee -a "$REPORT_FILE"
} | tee -a "$REPORT_FILE"

echo -e "\n${GREEN}✓ 性能测试完成！${NC}"
echo "报告位置: $REPORT_FILE"