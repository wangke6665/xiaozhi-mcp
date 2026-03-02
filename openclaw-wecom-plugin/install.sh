#!/bin/bash

set -e

echo "🦞 OpenClaw 企业微信插件 - 安装脚本"
echo "=================================="

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在插件根目录运行此脚本"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 编译TypeScript
echo "🔨 编译TypeScript..."
npm run build

# 创建扩展目录
echo "📁 创建扩展目录..."
EXT_DIR="/root/.openclaw/extensions/wecom"
mkdir -p "$EXT_DIR"

# 复制文件
echo "📋 复制插件文件..."
cp -r . "$EXT_DIR/"

# 创建符号链接到OpenClaw扩展
OPENCLAW_EXT="/usr/lib/node_modules/openclaw/extensions"
if [ -d "$OPENCLAW_EXT" ]; then
    echo "🔗 创建符号链接到OpenClaw..."
    rm -rf "$OPENCLAW_EXT/wecom"
    ln -sf "$EXT_DIR" "$OPENCLAW_EXT/wecom"
fi

echo ""
echo "✅ 安装完成!"
echo ""
echo "下一步:"
echo "1. 在OpenClaw配置文件中添加企业微信配置"
echo "2. 重启OpenClaw网关: openclaw gateway restart"
echo ""
echo "示例配置:"
echo "channels:"
echo "  wecom:"
echo "    enabled: true"
echo "    corpid: \"你的企业ID\""
echo "    corpsecret: \"你的应用Secret\""
echo "    agentid: \"你的应用ID\""
echo "    token: \"你的Token\""
echo "    encodingAESKey: \"你的EncodingAESKey\""
echo ""