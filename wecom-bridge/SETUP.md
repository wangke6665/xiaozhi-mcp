# 企业微信桥接服务 - 快速设置指南

## 📦 项目结构

```
wecom-bridge/
├── main.py                      # 主服务程序
├── wecom_client.py              # 企业微信API客户端
├── config.yaml                  # 配置文件
├── requirements.txt             # 依赖列表
├── test.py                      # 测试脚本
├── openclaw_integration.py      # OpenClaw集成示例
├── wecom-bridge.service         # Systemd服务配置
├── README.md                    # 完整文档
└── SETUP.md                     # 本文件
```

## 🚀 5分钟快速启动

### 第1步：配置企业微信

1. **登录企业微信管理后台** → 应用管理 → 应用 → 自建应用
2. **创建应用**（如果没有）
3. **获取信息**：
   - 企业ID (CorpID)
   - 应用Secret（点击「查看」）
   - 应用ID (AgentId)

4. **编辑配置文件**：
```bash
nano config.yaml
```

修改以下内容：
```yaml
wecom:
  corpid: "ww1234567890abcdef"  # 你的企业ID
  agent:
    secret: "xxxxxxxxxxxxxxxx"  # 你的应用Secret
    agentid: 1000001            # 你的应用ID
  to_user: "zhangsan"           # 接收人的UserID
```

### 第2步：获取接收人ID

**获取UserID：**
1. 管理后台 → 通讯录 → 成员管理
2. 点击成员，查看详情
3. 「账号」栏就是UserID

**获取部门ID：**
1. 管理后台 → 通讯录 → 组织架构
2. 点击部门，查看信息
3. 部门ID就是数字

### 第3步：启动服务

```bash
cd /root/.openclaw/workspace/wecom-bridge
/root/.openclaw/venv/bin/python main.py
```

服务将在 http://0.0.0.0:8900 启动

### 第4步：测试

打开新终端，运行测试：

```bash
cd /root/.openclaw/workspace/wecom-bridge
/root/.openclaw/venv/bin/python test.py
```

你应该能在企业微信中收到测试消息。

## 🔧 生产环境部署

### 使用Systemd（推荐）

```bash
# 1. 复制服务配置
cp wecom-bridge.service /etc/systemd/system/

# 2. 重新加载systemd
systemctl daemon-reload

# 3. 启动服务
systemctl start wecom-bridge

# 4. 设置开机自启
systemctl enable wecom-bridge

# 5. 查看状态
systemctl status wecom-bridge

# 6. 查看日志
journalctl -u wecom-bridge -f
```

### 常用命令

```bash
# 停止服务
systemctl stop wecom-bridge

# 重启服务
systemctl restart wecom-bridge

# 查看最近日志
journalctl -u wecom-bridge -n 50

# 清理日志
journalctl --vacuum-time=7d
```

## 📝 使用场景

### 场景1：API调用通知

在你的Python代码中：

```python
from openclaw_integration import WeComNotifier

notifier = WeComNotifier()
notifier.notify("✅ API调用成功")
```

### 场景2：定时任务通知

```bash
# 添加到crontab
0 9 * * * curl -X POST http://localhost:8900/send \
  -H "Content-Type: application/json" \
  -d '{"message": "📅 每日定时任务执行完成"}'
```

### 场景3：OpenClaw主动通知

在OpenClaw的配置中添加 webhook：

```python
# 当特定事件触发时
import requests

def send_to_wecom(text):
    requests.post("http://localhost:8900/webhook", json={"message": text})
```

## ⚙️ 配置选项详解

| 配置项 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| corpid | ✅ | 企业ID | ww1234567890abcdef |
| secret | ✅ | 应用Secret | xxxxxxxxxxxxxxxx |
| agentid | ✅ | 应用ID | 1000001 |
| to_user | ❌ | 接收人UserID | zhangsan\|lisi |
| to_party | ❌ | 接收部门ID | 1\|2 |
| webhook.enabled | ❌ | 是否使用群机器人 | false |
| webhook.key | ❌ | 群机器人key | xxxxx-xxx |

## 🐛 故障排查

### 问题1：消息发送失败，返回invalid user

**原因**：接收人ID错误或应用未分配给该用户

**解决**：
1. 确认UserID正确（注意大小写）
2. 在管理后台将应用分配给接收人

### 问题2：获取access_token失败

**原因**：企业ID或Secret错误

**解决**：
1. 检查配置文件中的corpid和secret
2. 确认应用已启用

### 问题3：服务无法启动

**原因**：端口被占用

**解决**：
```bash
# 查看端口占用
lsof -i:8900

# 修改配置文件中的端口
nano config.yaml
# 修改 port: 8900 → port: 8901
```

## 🔐 安全建议

1. **修改Webhook Secret**：
```yaml
openclaw:
  webhook_url: "http://localhost:18789/wecom"
  secret: "修改为一个强密码"
```

2. **限制访问**：使用防火墙限制访问
```bash
ufw allow from 127.0.0.1 to any port 8900
```

3. **定期更新**：保持依赖包最新
```bash
pip install --upgrade -r requirements.txt
```

## 📚 更多信息

- 完整API文档：查看 README.md
- 企业微信官方文档：https://developer.work.weixin.qq.com/
- OpenClaw文档：https://docs.openclaw.ai/

## 💡 下一步

1. ✅ 配置并测试基本功能
2. ✅ 部署到生产环境
3. ✅ 集成到你的应用或OpenClaw
4. ✅ 根据需求自定义消息格式

有问题？查看日志：
```bash
journalctl -u wecom-bridge -f
```