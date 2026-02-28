# 小智 AI MCP 客户端 (XiaoZhi MCP)

🦞 基于 OpenClaw 的小智 AI MCP 客户端实现，支持多种运行模式。

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `xiaozhi-client.js` | 基础版客户端 |
| `xiaozhi-client-optimized.js` | 优化版（英文工具名，提高 LLM 识别率） |
| `xiaozhi-client-persistent.js` | 长连接模式（支持心跳保活、上下文记忆） |
| `xiaozhi-mcp-bridge.js` | MCP 桥接器（stdio ↔ WebSocket） |
| `xiaozhi-monitor.sh` | 监控脚本 |
| `xiaozhi-mcp.service` | systemd 服务配置 |
| `scripts/start-qq.sh` | QQ 机器人启动脚本（NapCat） |

## 🔧 配置

### 1. 获取小智 MCP Token

1. 登录 [小智 AI 后台](https://api.xiaozhi.me)
2. 进入 **开发者设置** → **MCP 端点**
3. 复制你的 WebSocket 连接 URL（包含 token）

### 2. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env 文件，填入你的 token
nano .env
```

`.env` 文件内容示例：
```bash
XIAOZHI_MCP_URL=wss://api.xiaozhi.me/mcp/?token=YOUR_TOKEN_HERE
CLAWPANEL_QQ_TOKEN=clawpanel-qq  # 可选，QQ 机器人用
```

### 3. 加载环境变量

```bash
# 方法 1：临时加载（当前终端会话有效）
export $(cat .env | xargs)

# 方法 2：使用 dotenv 包
npm install dotenv

# 方法 3：在 systemd 服务中配置（见 xiaozhi-mcp.service）
```

## 🚀 运行

### 基础客户端
```bash
export $(cat .env | xargs)
node xiaozhi-client.js
```

### 优化版客户端
```bash
export $(cat .env | xargs)
node xiaozhi-client-optimized.js
```

### 长连接模式（推荐）
```bash
export $(cat .env | xargs)
node xiaozhi-client-persistent.js
```

### 使用 MCP 桥接器
```bash
export $(cat .env | xargs)
node xiaozhi-mcp-bridge.js
```

## 🔧 systemd 服务（开机自启）

```bash
# 1. 编辑服务文件，设置环境变量
sudo nano /etc/systemd/system/xiaozhi-mcp.service

# 2. 重新加载 systemd
sudo systemctl daemon-reload

# 3. 启动服务
sudo systemctl start xiaozhi-mcp

# 4. 设置开机自启
sudo systemctl enable xiaozhi-mcp

# 5. 查看状态
sudo systemctl status xiaozhi-mcp
```

## 📱 QQ 机器人（可选）

```bash
# 启动 NapCat QQ
./scripts/start-qq.sh

# 访问 WebUI 配置
# http://127.0.0.1:6099
# Token: clawpanel-qq (或你在 .env 中配置的值)
```

## ⚠️ 安全提示

- **切勿提交 `.env` 文件到 Git！** 已添加到 `.gitignore`
- Token 泄露请立即在小智后台重置
- 生产环境建议使用系统环境变量或密钥管理服务

## 📄 License

MIT
