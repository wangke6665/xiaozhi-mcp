# 小智 AI + OpenClaw 配置指南

## 🎯 目标
让小智硬件通过 MCP/WebSocket 协议连接到 OpenClaw，实现语音对话。

---

## 📋 服务器信息

| 项目 | 值 |
|------|-----|
| 公网 IP | `158.178.238.75` |
| WebSocket 端口 | `18790` |
| 完整地址 | `ws://158.178.238.75:18790/xiaozhi` |
| HTTP 测试 | `http://158.178.238.75:18790` |

---

## 🔧 小智控制台配置步骤

### 1. 登录小智 AI 控制台
- 访问 https://xiaozhi.me/console (或你的私有化部署控制台)
- 使用账号登录

### 2. 进入技能/MCP 管理
- 找到「技能市场」或「MCP 配置」页面
- 点击「添加自定义技能」或「添加 MCP 服务器」

### 3. 填写配置信息

```yaml
# 基本信息
名称: OpenClaw
描述: OpenClaw AI 助手
图标: 🤖 (可选)

# 连接配置
协议类型: WebSocket
服务器地址: ws://158.178.238.75:18790/xiaozhi

# 认证信息 (如需要)
Token: (留空，当前无需认证)
API Key: (留空)

# 高级选项
自动重连: 开启
心跳间隔: 30秒
超时时间: 10秒
```

### 4. 配置功能映射

根据小智控制台的界面，可能需要配置以下能力映射：

| 小智功能 | OpenClaw 端点 | 说明 |
|---------|--------------|------|
| 文本对话 | `type: chat` | 发送文字消息 |
| 语音交互 | `type: voice` | 语音转文字后处理 |
| 系统命令 | `type: command` | 执行特定指令 |

### 5. 保存并测试
- 点击「保存」或「应用」
- 使用「测试连接」功能验证
- 如果显示「连接成功」，即可使用

---

## 📡 通信协议详情

### 小智 → OpenClaw 请求格式

```json
// 1. 文本对话
{
  "type": "chat",
  "content": "今天天气怎么样？"
}

// 2. 语音输入（小智转文字后）
{
  "type": "voice",
  "text": "播放音乐"
}

// 3. 系统命令
{
  "type": "command",
  "command": "status",
  "args": {}
}
```

### OpenClaw → 小智 响应格式

```json
// 1. 欢迎消息（连接时自动发送）
{
  "type": "welcome",
  "message": "你好！我是 OpenClaw...",
  "timestamp": "2026-02-27T06:00:00.000Z"
}

// 2. 对话回复
{
  "type": "chat_response",
  "content": "OpenClaw 收到: '今天天气怎么样？'\n\n我可以帮你...",
  "timestamp": "2026-02-27T06:00:01.000Z"
}

// 3. 命令结果
{
  "type": "command_result",
  "result": "OpenClaw 运行正常",
  "timestamp": "2026-02-27T06:00:02.000Z"
}

// 4. 错误信息
{
  "type": "error",
  "message": "未知命令: xxx",
  "timestamp": "2026-02-27T06:00:03.000Z"
}
```

---

## 🧪 本地测试方法

在浏览器控制台或任意终端测试 WebSocket 连接：

```javascript
// 连接服务器
const ws = new WebSocket('ws://158.178.238.75:18790/xiaozhi');

// 监听消息
ws.onmessage = (e) => console.log('收到:', JSON.parse(e.data));

// 发送消息
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'chat',
    content: '你好 OpenClaw'
  }));
};
```

---

## 🔒 安全建议

当前配置为**无认证模式**，建议后续添加：

1. **Token 认证**: 在 URL 中添加 token 参数
   ```
   ws://158.178.238.75:18790/xiaozhi?token=YOUR_SECRET_TOKEN
   ```

2. **IP 白名单**: 限制只允许小智服务器的 IP 连接

3. **HTTPS/WSS**: 使用 SSL 加密连接
   ```
   wss://your-domain.com/xiaozhi
   ```

---

## 🐛 故障排查

### 问题 1: 连接失败
- 检查服务器是否运行: `curl http://158.178.238.75:18790`
- 检查防火墙是否开放 18790 端口
- 确认小智设备网络正常

### 问题 2: 消息无响应
- 检查消息格式是否为 JSON
- 确认 `type` 字段值为 `chat`/`voice`/`command` 之一
- 查看服务器日志: `tail -f /tmp/xiaozhi-server.log`

### 问题 3: 中文乱码
- 确保使用 UTF-8 编码
- 检查小智设备的字符集设置

---

## 📞 需要帮助？

配置过程中遇到问题，随时告诉我！我可以：
- 调整服务器配置
- 添加新的功能接口
- 协助排查连接问题
